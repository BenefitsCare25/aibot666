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
import adminRoutes from './api/routes/admin/index.js';
import aiSettingsRoutes from './api/routes/aiSettings.js';
import reembedRoutes from './api/routes/reembed.js';
import authRoutes from './api/routes/auth.js';
import adminUsersRoutes from './api/routes/adminUsers.js';
import rolesRoutes from './api/routes/roles.js';
import documentsRoutes from './api/routes/documents.js';

// Import services
import { initializeTelegramBot } from './api/services/telegram.js';
import { redis, closeRedis } from './api/utils/session.js';
import cron from 'node-cron';
import { runScheduledCheck } from './api/services/emailAutomationService.js';

// Start document processing worker (BullMQ — runs in same process)
import './api/workers/documentWorker.js';

dotenv.config();

// SRI hashes with TTL cache (re-reads from disk every 60s to survive deploys without restart)
import { readFileSync, existsSync } from 'fs';
import { createHash, randomBytes } from 'crypto';
import { join } from 'path';

const SRI_CACHE_TTL_MS = 60_000;
const sriHashPath = join(process.cwd(), 'public', 'sri-hashes.json');
let cachedSriHashes = { files: {} };
let sriCacheTimestamp = 0;

function loadSriHashes() {
  const now = Date.now();
  if (now - sriCacheTimestamp < SRI_CACHE_TTL_MS) return cachedSriHashes;

  try {
    if (existsSync(sriHashPath)) {
      cachedSriHashes = JSON.parse(readFileSync(sriHashPath, 'utf8'));
      sriCacheTimestamp = now;
    }
  } catch (e) {
    console.warn('SRI hashes not available:', e.message);
  }
  return cachedSriHashes;
}

// Validate SRI hashes match actual widget files on startup
function validateSriHashes() {
  const hashes = loadSriHashes();
  const publicDir = join(process.cwd(), 'public');

  for (const [filename, expectedHash] of Object.entries(hashes.files || {})) {
    const filePath = join(publicDir, filename);
    if (!existsSync(filePath)) {
      console.error(`[SRI] MISSING: ${filename} referenced in sri-hashes.json but file not found`);
      continue;
    }
    const content = readFileSync(filePath);
    const actualHash = `sha384-${createHash('sha384').update(content).digest('base64')}`;
    if (actualHash !== expectedHash) {
      console.error(`[SRI] MISMATCH: ${filename} — hash in sri-hashes.json does not match file on disk. Run: npm run build-widget`);
    }
  }
}

// Initial load + validation
loadSriHashes();
validateSriHashes();

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3001';

// Trust proxy - Required for deployment behind reverse proxies (Render, etc.)
// This allows express-rate-limit to correctly identify user IPs from X-Forwarded-For header
app.set('trust proxy', 1);

// M1: Generate per-request CSP nonce for inline scripts
app.use((req, res, next) => {
  res.locals.cspNonce = randomBytes(16).toString('base64');
  next();
});

// Security middleware - Relaxed for widget embedding
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      frameAncestors: ["*"],
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  frameguard: false, // Disable - handled by custom middleware for /chat route
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
  // Prevent clickjacking - but allow /chat route for iframe embedding
  // and /api/chat/log-form/ for file downloads opened in new tabs
  if (req.path !== '/chat' && !req.path.startsWith('/api/chat/log-form/')) {
    res.setHeader('X-Frame-Options', 'DENY');
  }

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

// Helper to extract clean IP from potentially malformed addresses (Azure adds port)
const getCleanIp = (req) => {
  let ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  // Remove port if present (e.g., "151.192.100.64:52535" -> "151.192.100.64")
  if (ip.includes(':') && !ip.includes('::')) {
    // IPv4 with port, not IPv6
    ip = ip.split(':')[0];
  }
  return ip;
};

// Rate limiting - General API limiter (per IP)
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getCleanIp(req),
  validate: { ip: false } // Disable built-in IP validation (Azure adds port to IP)
});

// Chat rate limiting - Per company (100 msg/min per company to allow concurrent users)
const chatLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: parseInt(process.env.CHAT_RATE_LIMIT_MAX) || 100, // 100 messages per minute per company
  message: {
    success: false,
    error: 'Too many messages from this company, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false }, // Disable built-in IP validation (Azure adds port to IP)
  keyGenerator: (req) => {
    // Extract company identifier from request (same logic as companyContext middleware)
    const domain = req.body?.domain ||
                   req.headers['x-widget-domain'] ||
                   req.headers.origin ||
                   req.headers.referer ||
                   getCleanIp(req);
    // Normalize: strip protocol and www
    const normalized = domain?.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || getCleanIp(req);
    return `chat:${normalized}`;
  }
});

// Strict rate limiter for authentication endpoints (brute force protection)
const authLimiter = rateLimit({
  windowMs: 60000,
  max: 10, // 10 login attempts per minute per IP
  message: { success: false, error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getCleanIp(req),
  validate: { ip: false }
});

// Strict rate limiter for anonymous LOG/callback endpoints (email abuse prevention)
const anonymousFormLimiter = rateLimit({
  windowMs: 60000,
  max: 5, // 5 submissions per minute per IP
  message: { success: false, error: 'Too many submissions, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getCleanIp(req),
  validate: { ip: false }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/chat/anonymous-log-request', anonymousFormLimiter);
app.use('/api/chat/callback-request', anonymousFormLimiter);
app.use('/api/chat', chatLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Standalone chat page for iframe embedding (with SRI protection)
app.get('/chat', (req, res) => {
  // Allow referrer for parent domain detection in iframe
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  try {
    const sriHashes = loadSriHashes();
    const jsIntegrity = sriHashes.files?.['widget.iife.js'] || '';
    const cssIntegrity = sriHashes.files?.['widget.css'] || '';
    const baseUrl = process.env.API_URL || process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;

    // Generate HTML with SRI
    const chatHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat Widget</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent !important;
      background-color: transparent !important;
    }
    #insurance-chat-widget-root {
      background: transparent !important;
    }
    .error { padding: 20px; color: #ef4444; font-family: system-ui; }
  </style>
  ${cssIntegrity
    ? `<link rel="stylesheet" href="${baseUrl}/widget.css" integrity="${cssIntegrity}" crossorigin="anonymous">`
    : `<link rel="stylesheet" href="${baseUrl}/widget.css">`
  }
</head>
<body>
  <div id="insurance-chat-widget-root"></div>
  ${jsIntegrity
    ? `<script src="${baseUrl}/widget.iife.js" integrity="${jsIntegrity}" crossorigin="anonymous"></script>`
    : `<script src="${baseUrl}/widget.iife.js"></script>`
  }
  <script nonce="${res.locals.cspNonce}">
    (function() {
      const params = new URLSearchParams(window.location.search);
      const companyId = params.get('company');
      if (!companyId) {
        document.getElementById('insurance-chat-widget-root').innerHTML = '<div class="error">Error: Missing company parameter</div>';
        return;
      }
      // Get domain: 1) from URL param, 2) from parent page (referrer), 3) fallback to current host
      // Preserve first path segment for multi-tenant routing (e.g., /cbre, /ntuc)
      let domain = params.get('domain');
      if (!domain && document.referrer) {
        try {
          const refUrl = new URL(document.referrer);
          const firstPathSegment = refUrl.pathname.split('/').filter(Boolean)[0];
          domain = firstPathSegment ? refUrl.hostname + '/' + firstPathSegment : refUrl.hostname;
        } catch (e) { console.debug('Referrer parse failed:', e.message); }
      }
      if (!domain) {
        const firstPathSegment = window.location.pathname.split('/').filter(Boolean)[0];
        domain = firstPathSegment ? window.location.hostname + '/' + firstPathSegment : window.location.hostname;
      }

      // Validate color parameter to prevent XSS
      var rawColor = decodeURIComponent(params.get('color') || '#3b82f6');
      var safeColor = /^#[0-9a-fA-F]{3,8}$/.test(rawColor) ? rawColor : '#3b82f6';

      if (window.InsuranceChatWidget) {
        window.InsuranceChatWidget.init({
          companyId: companyId,
          apiUrl: '${baseUrl}',
          primaryColor: safeColor,
          position: 'bottom-right',
          welcomeMessage: params.get('welcome') || undefined,
          domain: domain
        });
      }
    })();
  </script>
</body>
</html>`;

    res.type('text/html').send(chatHtml);
  } catch (error) {
    console.error('Error serving chat page:', error);
    res.status(500).send('Failed to load chat page');
  }
});

// Widget embed code endpoint - serves SRI-protected embed code
app.get('/embed-code', async (req, res) => {
  const format = req.query.format || 'html';

  try {
    const fs = await import('fs');
    const path = await import('path');

    if (format === 'json') {
      const hashesPath = path.join(process.cwd(), 'public', 'sri-hashes.json');
      if (fs.existsSync(hashesPath)) {
        const hashes = JSON.parse(fs.readFileSync(hashesPath, 'utf8'));
        return res.json(hashes);
      }
    }

    const embedPath = path.join(process.cwd(), 'public', 'embed-code.html');
    if (fs.existsSync(embedPath)) {
      const embedCode = fs.readFileSync(embedPath, 'utf8');
      res.type('text/html').send(embedCode);
    } else {
      res.status(404).json({
        success: false,
        error: 'Embed code not generated yet. Run: npm run generate-sri'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load embed code'
    });
  }
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

// Root endpoint — minimal info in production
app.get('/', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    return res.json({ name: 'API', status: 'ok' });
  }
  res.json({
    name: 'Insurance Chatbot API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      embedCode: '/embed-code',
      auth: '/api/auth/*',
      chat: '/api/chat/*',
      admin: '/api/admin/*'
    }
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

  // Generic error response - hide details in production
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    success: false,
    error: isProduction ? 'Internal server error' : (err.message || 'Internal server error'),
    ...(!isProduction && { stack: err.stack })
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

// Check email automation every minute — matches records by send_time (HH:MM SGT)
cron.schedule('* * * * *', async () => {
  try {
    await runScheduledCheck();
  } catch (err) {
    console.error('[EmailAutomation] Cron job failed unexpectedly:', err);
  }
}, { timezone: 'Asia/Singapore' });

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
