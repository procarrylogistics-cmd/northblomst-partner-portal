/**
 * Shopify webhook receiver – orders/create.
 * Uses SHOPIFY_WEBHOOK_SECRET (Webhook Signing Secret from Shopify Admin).
 */

const express = require('express');
const crypto = require('crypto');
const ShopifyWebhook = require('../models/ShopifyWebhook');

const router = express.Router();

/** GET /webhooks/ping – quick reachability check */
router.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

/**
 * POST /webhooks/orders_create
 * Validates HMAC, stores payload in MongoDB, responds 200 fast.
 */
router.post('/orders_create', async (req, res) => {
    const hmacHeader = (req.get('X-Shopify-Hmac-Sha256') || req.get('x-shopify-hmac-sha256') || '').trim();
    const shop = req.get('X-Shopify-Shop-Domain') || '';
    const topic = req.get('X-Shopify-Topic') || 'orders/create';

    const secret = (process.env.SHOPIFY_WEBHOOK_SECRET || '').trim();
    if (!secret) {
      return res.status(500).send('SHOPIFY_WEBHOOK_SECRET not configured');
    }
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).send('Invalid body');
    }

    const computed = crypto
      .createHmac('sha256', secret)
      .update(req.body)
      .digest('base64');
    const bufA = Buffer.from(computed, 'utf8');
    const bufB = Buffer.from(hmacHeader, 'utf8');
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return res.status(401).send('Invalid webhook signature');
    }

    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch (e) {
      return res.status(400).send('Invalid JSON');
    }

    console.log('Webhook orders/create received', {
      orderId: payload.id,
      name: payload.name,
      email: payload.email || (payload.customer && payload.customer.email),
      total_price: payload.total_price
    });

    await ShopifyWebhook.create({
      topic: topic || 'orders/create',
      shop: shop || '',
      payload
    });

    res.status(200).send('OK');
});

module.exports = router;
