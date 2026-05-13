import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

import { env } from './lib/env.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { eventsRouter } from './routes/events.js';
import { bookingsRouter } from './routes/bookings.js';
import { messagesRouter } from './routes/messages.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { errorHandler } from './middleware/error.js';

const app = express();

// Trust the first proxy hop so rate-limit keys on the real client IP behind a
// load balancer / reverse proxy; harmless in local dev.
app.set('trust proxy', 1);

app.use(helmet({
  // The frontend is on a separate origin in dev; allow cross-origin static asset
  // fetches (event photos) without tripping CORP.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // CSP is left disabled here because the API serves JSON, not HTML; the Vite
  // frontend manages its own CSP.
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// static uploads
app.use('/uploads', express.static(path.resolve(env.uploadDir)));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Auth endpoints get the strictest limiter to blunt brute-force / spam.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many auth attempts — please wait a few minutes and try again.' },
});

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/events', eventsRouter);
app.use('/api', bookingsRouter);          // /api/events/:id/bookings  + /api/bookings/mine
app.use('/api/messages', messagesRouter);
app.use('/api/recommendations', recommendationsRouter);

app.use(errorHandler);

function start() {
  if (env.useHttps) {
    try {
      const key = fs.readFileSync(env.sslKeyPath);
      const cert = fs.readFileSync(env.sslCertPath);
      https.createServer({ key, cert }, app).listen(env.port, () => {
        console.log(`HTTPS server listening on https://localhost:${env.port}`);
      });
      return;
    } catch (e) {
      // In production we never silently downgrade to HTTP — that masks a
      // misconfigured deployment and exposes traffic in clear text.
      if (env.nodeEnv === 'production') {
        console.error('HTTPS requested but certificates are not readable. Refusing to start.', e);
        process.exit(1);
      }
      console.warn('HTTPS requested but cert files not readable — falling back to HTTP (dev only).', e);
    }
  }
  http.createServer(app).listen(env.port, () => {
    console.log(`HTTP server listening on http://localhost:${env.port}`);
  });
}

start();
