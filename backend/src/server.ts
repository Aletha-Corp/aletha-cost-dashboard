import 'dotenv/config';
import { webcrypto } from 'crypto';
import path from 'path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { costRouter } from './routes/cost.routes';
import { securityRouter } from './routes/security.routes';
import { errorHandler } from './middleware/error-handler.middleware';
import { logger } from './utils/logger';

const app = express();

// Ensure Web Crypto is available for Azure SDKs in Node 18 (needed by @azure/identity).
if (!(globalThis as Record<string, unknown>).crypto) {
  (globalThis as Record<string, unknown>).crypto = webcrypto;
}

// ─── Security middleware ────────────────────────────────────────────────────
app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ['GET'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })
);

const limiter = rateLimit({
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
  max: parseInt(env.RATE_LIMIT_MAX, 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  // Azure App Service forwards IP:port in X-Forwarded-For — strip the port so the
  // rate-limiter gets a valid IP address key.
  keyGenerator: (req) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return ip.replace(/:\d+$/, '').replace(/^::ffff:/, '');
  },
  validate: { ip: false },
});
app.set('trust proxy', 1);
app.use('/api/', limiter);

// ─── General middleware ─────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Disable x-powered-by (helmet does this, but belt-and-suspenders)
app.disable('x-powered-by');

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/costs', costRouter);
app.use('/api/security', securityRouter);

// Root liveness probe (used by Azure App Service)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error handler (must be last) ───────────────────────────────────────────
app.use(errorHandler);

// ─── Serve static frontend in production ────────────────────────────────────
if (env.NODE_ENV === 'production') {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist, { maxAge: '7d', etag: true }));
  // SPA catch-all — must come after API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = parseInt(env.PORT, 10);
app.listen(PORT, () => {
  logger.info(`Azure Cost Dashboard API listening on port ${PORT} [${env.NODE_ENV}]`);
});

export default app;
