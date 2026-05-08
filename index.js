'use strict';

// ── Load environment variables first ─────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./src/config/db');
const errorHandler = require('./src/middlewares/errorHandler');
const { apiLimiter } = require('./src/middlewares/rateLimiter');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');

// ── Route factories / models ──────────────────────────────────────────────────
const authRoutes = require('./src/routes/auth');
const transactionRoutes = require('./src/routes/transactions');
const dashboardRoutes = require('./src/routes/dashboard');
const createFinancialRouter = require('./src/routes/financialRouter');
const createFinancialController = require('./src/controllers/financialController');
const Expense = require('./src/models/Expense');
const Income = require('./src/models/Income');

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();

// Trust proxy — needed for rate-limiter & correct IP when behind reverse proxy
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
const defaultOrigins = [
  'http://localhost:3000',
  'https://jumatan-il.vercel.app',
  'https://jumatan-il.infinitelearningstudent.id'
];

const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [];

const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' is not allowed.`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ── Request parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' })); // Reject suspiciously large payloads
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ── Sanitize data ────────────────────────────────────────────────────────────
// Data sanitization against NoSQL query injection
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body, { replaceWith: '_' });
  if (req.query) mongoSanitize.sanitize(req.query, { replaceWith: '_' });
  if (req.params) mongoSanitize.sanitize(req.params, { replaceWith: '_' });
  next();
});
// ── HTTP request logger ───────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
}

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Kas Jumatan API is running 🕌',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Expense & Income share the same shape — use factories
app.use('/api/expenses', createFinancialRouter(createFinancialController(Expense, 'Expense')));
app.use('/api/incomes', createFinancialRouter(createFinancialController(Income, 'Income')));

// ── 404 handler for unknown routes ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 9870;

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`🚀  Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = (signal) => {
    console.log(`\n🛑  ${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      const mongoose = require('mongoose');
      await mongoose.disconnect();
      console.log('🔌  MongoDB disconnected. Process exiting.');
      process.exit(0);
    });

    // Force-exit after 10 s if graceful shutdown stalls
    setTimeout(() => {
      console.error('⚠️  Forced shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error('💥  Unhandled Promise Rejection:', err.message);
    server.close(() => process.exit(1));
  });
};

startServer();

module.exports = app; // export for testing
