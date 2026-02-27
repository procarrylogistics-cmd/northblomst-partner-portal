require('dotenv').config();
require('express-async-errors');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');

const axios = require('axios');
const User = require('./src/models/User');
const ShopifyStore = require('./src/models/ShopifyStore');
const authRoutes = require('./src/routes/auth');
const partnerRoutes = require('./src/routes/partners');
const orderRoutes = require('./src/routes/orders');
const shopifyRoutes = require('./src/routes/shopify');
const zapierRoutes = require('./src/routes/zapier');
const emailRoutes = require('./src/routes/email');
const reportsRoutes = require('./src/routes/reports');
const setupRoutes = require('./src/routes/setup');
const shopifyProxyRoutes = require('./src/routes/shopifyProxy');
const shopifyOAuthRoutes = require('./src/routes/shopifyOAuth');
const shopifyWebhooksRoutes = require('./src/routes/shopifyWebhooks');

const { authMiddleware } = require('./src/middleware/auth');

const app = express();

// Webhooks FIRST – raw body before any body-parser (must precede express.json)
app.use('/webhooks', express.raw({ type: 'application/json' }), shopifyWebhooksRoutes);

// CORS – allow local dev + production frontend on Render
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://northblomst-partner-portal-frontend.onrender.com',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean) : [])
];
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // e.g. same-origin, Postman
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (/^https:\/\/[\w-]+\.onrender\.com$/.test(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(cookieParser());
app.use(morgan('dev'));

app.use('/api/webhooks/shopify', express.raw({ type: '*/*' }), shopifyRoutes);

app.use(express.json({ limit: '2mb' }));

// Health checks
app.get('/', (req, res) => res.status(200).send('OK'));
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' }));

// Shopify OAuth stored-token test (public, for verification)
app.get('/api/shopify/test', async (req, res) => {
  try {
    const store = await ShopifyStore.findOne().sort({ installedAt: -1 });
    if (!store) {
      return res.json({ success: false, error: 'No Shopify store connected. Run OAuth first.' });
    }
    const { data } = await axios.post(
      `https://${store.shop}/admin/api/2024-01/graphql.json`,
      { query: '{ shop { name } }' },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': store.accessToken
        }
      }
    );
    res.json({
      success: true,
      shopName: data?.data?.shop?.name || 'N/A',
      shop: store.shop
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      error: err.response?.data?.errors?.[0]?.message || err.message || 'GraphQL request failed'
    });
  }
});

// Email config check (public)
app.get('/api/email/check', (req, res) => {
  res.json({ configured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS) });
});

// Public routes – OAuth with full paths, mount at root
app.use(shopifyOAuthRoutes);
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
