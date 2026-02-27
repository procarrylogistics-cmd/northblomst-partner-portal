/**
 * Shopify webhook receiver – orders/create.
 * Uses SHOPIFY_WEBHOOK_SECRET (Webhook Signing Secret), NOT SHOPIFY_API_SECRET.
 */

const express = require('express');
const crypto = require('crypto');
const ShopifyOrder = require('../models/ShopifyOrder');

const router = express.Router();

/** GET /webhooks/ping – quick reachability check */
router.get('/ping', (req, res) => {
  res.json({ ok: true });
});

/**
 * POST /webhooks/orders_create
 * Validates HMAC, stores payload in MongoDB, responds 200 fast.
 */
router.post(
  '/orders_create',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256') || '';
    const shop = req.get('X-Shopify-Shop-Domain') || '';
    const topic = req.get('X-Shopify-Topic') || 'orders/create';
    const webhookId = req.get('X-Shopify-Webhook-Id') || '';

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
      return res.status(401).send('Invalid webhook HMAC');
    }

    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch (e) {
      return res.status(400).send('Invalid JSON');
    }

    const orderId = payload.id != null ? String(payload.id) : '';
    const orderNumber = payload.order_number != null
      ? String(payload.order_number)
      : (payload.name != null ? String(payload.name) : '');

    await ShopifyOrder.create({
      shop,
      topic,
      webhookId,
      orderId,
      orderNumber,
      payload
    });

    res.status(200).send('OK');
  }
);

module.exports = router;
