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
    const scopes = (process.env.SHOPIFY_SCOPES || 'read_orders,read_products,write_orders').replace(/\s/g, '');
    const appUrl = (process.env.SHOPIFY_APP_URL || '').trim().replace(/\/$/, '');
    const redirectUri = `${appUrl}/auth/shopify/callback`.trim();
    const state = crypto.randomBytes(16).toString('hex');
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    res.redirect(authUrl);
  } catch (err) {
    console.error('Shopify OAuth init error:', err);
    res.status(500).send(err.message || 'OAuth init failed');
  }
});

/**
 * Validate HMAC from Shopify OAuth callback.
 * Uses req.originalUrl query string, URLSearchParams, sorted params, HMAC-SHA256.
 */
function validateHmac(req, secret) {
  const rawUrl = req.originalUrl || '';
  const qs = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : '';
  const params = new URLSearchParams(qs);

  const receivedHmac = params.get('hmac') || '';
  params.delete('hmac');
  params.delete('signature');

  const entries = Array.from(params.entries())
    .sort((a, b) => a[0].localeCompare(b[0]));
  const message = entries.map(([k, v]) => `${k}=${v}`).join('&');

  const secretTrimmed = String(secret || '').trim();
  const computedHmac = crypto
    .createHmac('sha256', secretTrimmed)
    .update(message)
    .digest('hex');

  const bufReceived = Buffer.from(receivedHmac.toLowerCase(), 'utf8');
  const bufComputed = Buffer.from(computedHmac.toLowerCase(), 'utf8');
  const valid =
    bufReceived.length === bufComputed.length &&
    crypto.timingSafeEqual(bufReceived, bufComputed);

  if (!valid) {
    console.error('HMAC validation failed:', {
      receivedHmac,
      computedHmac,
      message,
      secretLength: secretTrimmed.length
    });
  }
  return valid;
}

/**
 * GET /auth/shopify/callback?code=...&hmac=...&shop=...&state=...&timestamp=...
 * Public route – no auth middleware.
 */
router.get('/auth/shopify/callback', async (req, res) => {
  try {
    const { code, shop } = req.query;
    const shopNorm = normalizeShop(shop);
    if (!shopNorm || !code) {
      return res.status(400).send('Missing shop or code');
    }
    const apiSecret = (process.env.SHOPIFY_API_SECRET || '').trim();
    if (!apiSecret) {
      return res.status(500).send('SHOPIFY_API_SECRET not configured');
    }
    if (!validateHmac(req, apiSecret)) {
      return res.status(401).send('Invalid HMAC');
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
    res.status(200).send('Shopify connected successfully');
  } catch (err) {
    console.error('Shopify OAuth callback error:', err);
    res.status(500).send(err.response?.data || err.message || 'OAuth callback failed');
  }
});

module.exports = router;
