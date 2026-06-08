import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import planRoutes from './routes/plans.js';
import drawRoutes from './routes/draws.js';
import ticketRoutes from './routes/tickets.js';
import reportRoutes from './routes/reports.js';
import printBridgeRoutes from './routes/printBridge.js';
import specialMultiplierRoutes from './routes/specialMultipliers.js';
import paymentRoutes from './routes/payments.js';
import cashMovementRoutes from './routes/cashMovements.js';
import roleRoutes from './routes/roles.js';
import announcementRoutes from './routes/announcements.js';
import numberRestrictionRoutes from './routes/numberRestrictions.js';

const app = express();

// ── Security & utilities ──────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

// ── Static files ──────────────────────────────────────────────────────────────
app.use(
  '/public',
  express.static('public', {
    setHeaders: (res) => {
      // Allow frontend on a different origin (e.g. localhost:5173) to render images.
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

// ── Rate limiting ─────────────────────────────────────────────────────────────

// Strict limit for auth endpoints (login, refresh) to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
});

// General API limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Límite de solicitudes superado. Intenta más tarde.' },
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/plans', apiLimiter, planRoutes);
app.use('/api/draws', apiLimiter, drawRoutes);
app.use('/api/tickets', apiLimiter, ticketRoutes);
app.use('/api/reports', apiLimiter, reportRoutes);
app.use('/api/print-bridge', apiLimiter, printBridgeRoutes);
app.use('/api/special-multipliers', apiLimiter, specialMultiplierRoutes);
app.use('/api/payments', apiLimiter, paymentRoutes);
app.use('/api/cash-movements', apiLimiter, cashMovementRoutes);
app.use('/api/roles', apiLimiter, roleRoutes);
app.use('/api/announcements', apiLimiter, announcementRoutes);
app.use('/api/number-restrictions', apiLimiter, numberRestrictionRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada.' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`🚀  GameOver API running on http://localhost:${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   CORS origin: ${config.corsOrigin}`);
});

export default app;
