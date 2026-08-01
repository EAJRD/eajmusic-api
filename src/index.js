import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { prisma } from './lib/prisma.js';
import { getObjectStream } from './services/minioStorageService.js';

// Import routes
import authRoutes from './routes/auth.js';
import artistRoutes from './routes/artist.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/upload.js';
import paymentRoutes from './routes/payment.js';
import publicRoutes from './routes/public.js';
// NEXT: mount additional routers here as they're built, e.g.
//   import walletRoutes from './routes/wallet.js';
//   app.use('/api/wallet', walletRoutes);
// `artistRoutes` above already covers /api/artist/* (releases, wallet,
// analytics, profiles) - extend that router directly rather than adding a
// parallel one unless a genuinely separate resource is being introduced.

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/auth.js';
import { csrfProtection } from './middleware/csrf.js';

// Initialize
const app = express();
const PORT = process.env.PORT || 5001;

// Behind Cloudflare Tunnel / Nginx in every deployment target - without this,
// req.protocol always reports "http" (breaking API_URL-less URL building) and
// req.ip / express-rate-limit see the proxy's IP for every request instead of
// the real client, effectively pooling all users into one rate-limit bucket.
app.set('trust proxy', 1);

// ===========================================
// MIDDLEWARE
// ===========================================

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) {
      if (process.env.NODE_ENV === 'development') return callback(null, true);
      const err = new Error('Origin required');
      err.statusCode = 403;
      return callback(err);
    }
    if (corsOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    const err = new Error('Not allowed by CORS');
    err.statusCode = 403;
    callback(err);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id', 'X-CSRF-Token'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookies - required to read the eajmusic_token / eajmusic_refresh /
// eajmusic_csrf cookies set by src/utils/cookies.js.
app.use(cookieParser());

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts, please try again in 15 minutes.' },
});
// The real login/register path since InsForge became the credential front
// door - every signIn/signUp/OAuth exchange calls this to mint this API's
// own session. The old bcrypt-based /login and /register routes (which used
// to carry this same limiter) were removed entirely.
app.use('/api/auth/sync-insforge-user', authLimiter);

// Serve uploads: MinIO first (primary storage as of the file-storage
// migration - see src/services/minioStorageService.js), falling back to
// local disk for anything uploaded before that / when MinIO has neither the
// object nor is configured. The public URL shape (`/uploads/:type/:filename`)
// never changed, so this is a transparent swap for existing clients/links.
const UPLOAD_MIME_TYPES = {
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
  '.m4a': 'audio/mp4', '.mp4': 'audio/mp4',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.pdf': 'application/pdf',
};

async function serveUpload(req, res) {
  const { type, filename } = req.params;
  const objectKey = `${type}/${filename}`;
  const contentType = UPLOAD_MIME_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream';

  const minioStream = await getObjectStream(objectKey);
  if (minioStream) {
    res.setHeader('Content-Type', contentType);
    minioStream.on('error', () => { if (!res.headersSent) res.status(500).end(); });
    return minioStream.pipe(res);
  }

  const localPath = path.join(process.env.UPLOAD_DIR || './uploads', type, filename);
  if (fs.existsSync(localPath)) {
    return res.sendFile(path.resolve(localPath));
  }

  res.status(404).json({ error: 'Not Found', message: 'File not found' });
}

// `images` (cover art, avatars, testimonial photos) are meant to be public -
// they're rendered on unauthenticated pages (the /talent directory, public
// testimonials, DSPs eventually). `audio` (full-quality WAV/FLAC masters)
// and `documents` (KYC ID uploads) stay behind auth. Gating every type
// equally in production was a real bug: it hadn't surfaced yet only because
// no one had uploaded a real avatar/cover/testimonial photo yet (test
// accounts all still use the ui-avatars.com placeholder) - the moment one
// did, that image would 401 on every public page that renders it.
function requireAuthUnlessPublicType(req, res, next) {
  if (req.params.type === 'images') return next();
  return authenticate(req, res, next);
}

if (process.env.NODE_ENV !== 'production') {
  app.get('/uploads/:type/:filename', serveUpload);
} else {
  app.get('/uploads/:type/:filename', requireAuthUnlessPublicType, serveUpload);
}

// CSRF (double-submit cookie) - must run after cookieParser (reads the
// eajmusic_csrf cookie) and after body parsing is irrelevant here since it
// only inspects the header/cookie, but it must run before the route
// handlers it's protecting.
app.use(csrfProtection);

// Defense in depth: `new URLSearchParams({ role: undefined })` on the
// frontend serializes an omitted optional filter as the literal string
// "undefined" (e.g. `?role=undefined`), which route handlers then treat as a
// real, truthy filter value instead of "no filter" - this broke
// GET /admin/users and GET /admin/releases in production. The frontend was
// fixed to stop sending this, but strip it here too so any other caller
// (old cached bundle, direct API use) can't trigger the same class of bug.
app.use((req, res, next) => {
  for (const key of Object.keys(req.query)) {
    if (req.query[key] === 'undefined' || req.query[key] === 'null') {
      delete req.query[key];
    }
  }
  next();
});

// ===========================================
// ROUTES
// ===========================================

// Simple liveness check for load balancers / uptime monitors - no DB call,
// always 200 as long as the process is up.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Database connection failed',
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/artist', artistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/public', publicRoutes);

// ===========================================
// ERROR HANDLING
// ===========================================

app.use(notFoundHandler);
app.use(errorHandler);

// ===========================================
// GRACEFUL SHUTDOWN
// ===========================================

const shutdown = async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ===========================================
// START SERVER
// ===========================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    EAJMUSIC API SERVER                    ║
╠═══════════════════════════════════════════════════════════╣
║  Status:      RUNNING                                     ║
║  Port:        ${PORT}                                         ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(41)}║
║  API URL:     http://localhost:${PORT}/api                    ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export { prisma };
