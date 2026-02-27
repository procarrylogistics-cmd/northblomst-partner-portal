/**
 * Shopify OAuth install flow: GET /auth/shopify, GET /auth/shopify/callback
 */

const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const ShopifyStore = require('../models/ShopifyStore');

const router = express.Router();

function getEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

/** Normalize shop domain (add .myshopify.com if needed) */
function normalizeShop(shop) {
  const s = String(shop || '').trim().toLowerCase();
  if (!s) return null;
  if (s.endsWith('.myshopify.com')) return s;
  return `${s}.myshopify.com`;
}

/**
 * GET /auth/shopify?shop=northblomst-dev.myshopify.com
 * Redirects to Shopify OAuth authorization
 */
router.get('/auth/shopify', (req, res) => {
  try {
    const shop = normalizeShop(req.query.shop);
    if (!shop) {
      return res.status(400).send('Missing or invalid shop query parameter');
    }
    const apiKey = getEnv('SHOPIFY_API_KEY');
    const scopes = (process.env.SHOPIFY_SCOPES || 'read_orders').replace(/\s/g, '');
    const appUrl = getEnv('SHOPIFY_APP_URL').replace(/\/$/, '');
    const redirectUri = `${appUrl}/auth/shopify/callback`;
    const state = crypto.randomBytes(16).toString('hex');
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    res.redirect(authUrl);
  } catch (err) {
    console.error('Shopify OAuth init error:', err);
    res.status(500).send(err.message || 'OAuth init failed');
  }
});

/**
 * Validate HMAC from Shopify callback
 */
function validateHmac(queryParams, secret) {
  const hmac = queryParams.hmac;
  const params = { ...queryParams };
  delete params.hmac;
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const digest = crypto.createHmac('sha256', secret).update(message).digest('base64');
  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(hmac || '', 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * GET /auth/shopify/callback?code=...&hmac=...&shop=...&state=...&timestamp=...
 */
router.get('/auth/shopify/callback', async (req, res) => {
  try {
    const { code, hmac, shop, state, timestamp } = req.query;
    const shopNorm = normalizeShop(shop);
    if (!shopNorm || !code) {
      return res.status(400).send('Missing shop or code');
    }
    const apiSecret = getEnv('SHOPIFY_API_SECRET');
    const params = { code, shop: shopNorm, state: state || '', timestamp: timestamp || '' };
    if (!validateHmac({ ...params }, apiSecret)) {
      return res.status(403).send('Invalid HMAC');
    }
    const apiKey = getEnv('SHOPIFY_API_KEY');
    const tokenUrl = `https://${shopNorm}/admin/oauth/access_token`;
    const { data } = await axios.post(tokenUrl, {
      client_id: apiKey,
      client_secret: apiSecret,
      code
    });
    const accessToken = data.access_token;
    if (!accessToken) {
      return res.status(500).send('No access token in response');
    }
    await ShopifyStore.findOneAndUpdate(
      { shop: shopNorm },
      { accessToken, installedAt: new Date() },
      { upsert: true, new: true }
    );
    const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'https://northblomst-partner-portal.vercel.app';
    res.redirect(`${frontendUrl}?shopify=connected`);
  } catch (err) {
    console.error('Shopify OAuth callback error:', err);
    res.status(500).send(err.response?.data || err.message || 'OAuth callback failed');
  }
});

module.exports = router;
