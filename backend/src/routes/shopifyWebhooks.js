/**
 * Shopify webhook receiver – orders/create.
 * Uses SHOPIFY_WEBHOOK_SECRET (Webhook Signing Secret from Shopify Admin).
 */

const express = require('express');
const crypto = require('crypto');

const router = express.Router();

/** GET /webhooks/ping – quick reachability check */
router.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

/**
 * POST /webhooks/orders_create
 * Validates HMAC over raw body, responds 200 fast.
 */
router.post('/orders_create', async (req, res) => {
  const received = req.get('x-shopify-hmac-sha256') || '';
  const secret = (process.env.SHOPIFY_WEBHOOK_SECRET || '').trim();

  if (!secret) {
    return res.status(500).send('SHOPIFY_WEBHOOK_SECRET not configured');
  }
  if (!Buffer.isBuffer(req.body)) {
    console.error('WEBHOOK HMAC FAIL', {
      received,
      bodyIsBuffer: false,
      contentType: req.get('content-type')
    });
    return res.status(400).send('Invalid body');
  }

  const computed = crypto.createHmac('sha256', secret).update(req.body).digest('base64');
  const bufA = Buffer.from(computed, 'utf8');
  const bufB = Buffer.from(received, 'utf8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    console.error('WEBHOOK HMAC FAIL', {
      received,
      computed,
      secretLength: secret.length,
      bodyIsBuffer: Buffer.isBuffer(req.body),
      bodyLength: Buffer.isBuffer(req.body) ? req.body.length : null,
      contentType: req.get('content-type')
    });
    return res.status(401).send('Invalid webhook signature');
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch (e) {
    return res.status(400).send('Invalid JSON');
  }

  console.log('Webhook orders/create received', { orderId: payload.id, name: payload.name });
  res.status(200).send('OK');
});

module.exports = router;
