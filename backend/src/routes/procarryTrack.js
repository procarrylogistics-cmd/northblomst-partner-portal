const express = require('express');
const crypto = require('crypto');
const Order = require('../models/Order');

const router = express.Router();

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyWebhookSecret(req) {
  const expected = (process.env.PROCARRY_TRACK_WEBHOOK_SECRET || '').trim();
  if (!expected) return false;

  const headerSecret =
    req.headers['x-procarry-track-secret'] ||
    req.headers['x-webhook-secret'] ||
    '';
  if (headerSecret && safeEqual(headerSecret, expected)) return true;

  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token && safeEqual(token, expected)) return true;
  }

  return false;
}

/**
 * POST /api/webhooks/procarry-track
 * Body: { portalOrderId, orderNumber, trackingUrl, trackingNumber, status, procarryTrackOrderId }
 * status: "tracking" | "delivered"
 */
router.post('/', async (req, res) => {
  if (!process.env.PROCARRY_TRACK_WEBHOOK_SECRET?.trim()) {
    return res.status(503).json({ message: 'Webhook not configured' });
  }

  if (!verifyWebhookSecret(req)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const {
    portalOrderId,
    orderId,
    trackingUrl,
    trackingNumber,
    status,
    procarryTrackOrderId
  } = req.body || {};

  const id = portalOrderId || orderId;
  if (!id) {
    return res.status(400).json({ message: 'portalOrderId required' });
  }

  const order = await Order.findById(id);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  // Never move a fulfilled/cancelled order backwards
  const terminal = order.status === 'fulfilled' || order.status === 'cancelled';

  if (trackingUrl) order.trackingUrl = trackingUrl;
  if (trackingNumber) order.trackingNumber = trackingNumber;
  if (procarryTrackOrderId && !order.procarryTrackOrderId) {
    order.procarryTrackOrderId = String(procarryTrackOrderId);
  }

  const normalized = String(status || '').toLowerCase();
  if (normalized === 'delivered' && !terminal) {
    order.status = 'fulfilled';
  }

  await order.save();
  res.json({ success: true, status: order.status });
});

module.exports = router;
