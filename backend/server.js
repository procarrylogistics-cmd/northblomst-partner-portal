require('dotenv').config();
require('express-async-errors');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');

const User = require('./src/models/User');
const authRoutes = require('./src/routes/auth');
const partnerRoutes = require('./src/routes/partners');
const orderRoutes = require('./src/routes/orders');
const shopifyRoutes = require('./src/routes/shopify');
const zapierRoutes = require('./src/routes/zapier');
const emailRoutes = require('./src/routes/email');
const reportsRoutes = require('./src/routes/reports');
const setupRoutes = require('./src/routes/setup');
const shopifyProxyRoutes = require('./src/routes/shopifyProxy');

const { authMiddleware } = require('./src/middleware/auth');

const app = express();

const isDev = process.env.NODE_ENV !== 'production';
const corsOrigin = process.env.CORS_ORIGIN || (isDev ? 'http://localhost:5173' : process.env.FRONTEND_ORIGIN || 'http://localhost:5173');
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// Webhook Shopify – raw body pentru HMAC; înainte de express.json
app.use('/api/webhooks/shopify', express.raw({ type: '*/*' }), shopifyRoutes);

app.use(express.json({ limit: '2mb' }));

// Health checks
app.get('/', (req, res) => res.status(200).send('OK'));
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' }));

// Email config check (public)
app.get('/api/email/check', (req, res) => {
  res.json({ configured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS) });
});

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/webhooks/zapier', zapierRoutes);

// Protected routes
app.use('/api/partners', authMiddleware, partnerRoutes);
app.use('/api/orders', authMiddleware, orderRoutes);
app.use('/api/email', authMiddleware, emailRoutes);
app.use('/api/reports', authMiddleware, reportsRoutes);
app.use('/api/shopify', shopifyProxyRoutes);
app.use('/api', authMiddleware, setupRoutes);

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

async function ensureAdminUser() {
  const count = await User.countDocuments();
  if (count === 0) {
    await User.create({
      name: 'Northblomst Admin',
      email: 'admin@northblomst.dk',
      passwordHash: await User.hashPassword('admin123'),
      role: 'admin'
    });
    console.log('Created default admin: admin@northblomst.dk / admin123');
  }
}

mongoose
  .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  .then(async () => {
    console.log('MongoDB connected');
    if (process.env.NODE_ENV !== 'production') {
      await ensureAdminUser();
    }
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;
