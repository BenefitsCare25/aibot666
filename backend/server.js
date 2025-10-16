import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import 'express-async-errors';

// Import routes
import chatRoutes from './api/routes/chat.js';
import adminRoutes from './api/routes/admin.js';

// Import services
import { initializeTelegramBot } from './api/services/telegram.js';
import { redis, closeRedis } from './api/utils/session.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3001';

// Security middleware - Relaxed for widget embedding
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP to allow widget embedding
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration - Allow widget embedding
app.use(cors({
  origin: CORS_ORIGIN.split(',').map(origin => origin.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Insurance Chatbot API',
    version: '1.0.0',
    description: 'AI-powered insurance chatbot with RAG capabilities',
    endpoints: {
      health: '/health',
      chat: '/api/chat/*',
      admin: '/api/admin/*'
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
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    // Close Redis connection
    await closeRedis();

    // Close server
    server.close(() => {
      console.log('HTTP server closed');
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
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Insurance Chatbot API Server');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log(`  🚀 Server running on port ${PORT}`);
  console.log(`  🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  📡 API Base URL: http://localhost:${PORT}`);
  console.log(`  🏥 Health Check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('  Endpoints:');
  console.log(`    - Chat API: /api/chat`);
  console.log(`    - Admin API: /api/admin`);
  console.log('');
  console.log('  Services:');
  console.log(`    ✓ OpenAI API: ${process.env.OPENAI_API_KEY ? 'Configured' : '⚠ Not configured'}`);
  console.log(`    ✓ Supabase: ${process.env.SUPABASE_URL ? 'Configured' : '⚠ Not configured'}`);
  console.log(`    ✓ Redis: ${redis.status === 'ready' ? 'Connected' : '⚠ Not connected'}`);
  console.log(`    ✓ Telegram Bot: ${process.env.TELEGRAM_BOT_TOKEN ? 'Configured' : '⚠ Not configured'}`);
  console.log('');
  console.log('  Press Ctrl+C to stop the server');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
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
