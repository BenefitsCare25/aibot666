import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import 'express-async-errors';

// Import routes
import chatRoutes from './api/routes/chat.js';
import adminRoutes from './api/routes/admin.js';
import aiSettingsRoutes from './api/routes/aiSettings.js';
import reembedRoutes from './api/routes/reembed.js';
import authRoutes from './api/routes/auth.js';
import adminUsersRoutes from './api/routes/adminUsers.js';
import rolesRoutes from './api/routes/roles.js';
import documentsRoutes from './api/routes/documents.js';

// Import services
import { initializeTelegramBot } from './api/services/telegram.js';
import { redis, closeRedis } from './api/utils/session.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3001';

// Trust proxy - Required for deployment behind reverse proxies (Render, etc.)
// This allows express-rate-limit to correctly identify user IPs from X-Forwarded-For header
app.set('trust proxy', 1);

// Security middleware - Relaxed for widget embedding
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP to allow widget embedding
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration - Allow widget embedding from any domain
// Widget endpoints (/api/chat, /widget.*) accept requests from any domain
// Admin endpoints (/api/admin) only accept whitelisted domains
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow requests with no origin (like Postman, curl)
  if (!origin) {
    return next();
  }

  // Check if this is a widget-related endpoint
  const isWidgetEndpoint =
    req.path.startsWith('/api/chat') ||
    req.path.startsWith('/widget') ||
    req.path === '/health';

  if (isWidgetEndpoint) {
    // Allow any origin for widget endpoints
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Widget-Domain');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
  } else {
    // Admin endpoints - check whitelist
    const allowedOrigins = CORS_ORIGIN.split(',').map(o => o.trim());
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Widget-Domain');

      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
    } else {
      // Origin not allowed for admin endpoints
      return res.status(403).json({ error: 'CORS policy: Origin not allowed' });
    }
  }

  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing middleware
app.use(cookieParser());

// Security headers for admin authentication
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Disable client-side caching for API routes
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
});

// Compression middleware
app.use(compression());

// Serve static files (widget)
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: redis.status === 'ready' ? 'connected' : 'disconnected'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin-users', adminUsersRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/documents', documentsRoutes);
app.use('/api/ai-settings', aiSettingsRoutes);
app.use('/api/reembed', reembedRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Insurance Chatbot API',
    version: '1.0.0',
    description: 'AI-powered insurance chatbot with RAG capabilities',
    endpoints: {
      health: '/health',
      auth: '/api/auth/*',
      adminUsers: '/api/admin-users/*',
      chat: '/api/chat/*',
      admin: '/api/admin/*',
      aiSettings: '/api/ai-settings/*'
    },
    documentation: '/api/docs'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File size too large. Maximum 10MB allowed.'
    });
  }

  if (err.message && err.message.includes('Only Excel files')) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  // Generic error response
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {

  try {
    // Close Redis connection
    await closeRedis();

    // Close server
    server.close(() => {
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Initialize Telegram bot
try {
  initializeTelegramBot();
} catch (error) {
  console.error('Failed to initialize Telegram bot:', error);
  console.warn('Continuing without Telegram integration...');
}

// Start server
const server = app.listen(PORT, () => {
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

export default app;
