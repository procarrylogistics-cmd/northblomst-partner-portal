/**
 * Admin setup routes: webhooks Shopify, etc.
 */

const express = require('express');
const {
  createWebhook,
  getWebhooks,
  deleteWebhook,
  webhookExists
} = require('../utils/shopify');
const { requireRole } = require('../middleware/auth');
const Order = require('../models/Order');
const { extractDeliveryFromOrderDoc } = require('../utils/deliveryDateExtractor');

const router = express.Router();

const SHOPIFY_WEBHOOK_TOPICS = ['orders/create', 'orders/updated', 'orders/cancelled'];

/** POST /api/setup-webhooks - creează webhooks în Shopify (admin only) */
router.post('/setup-webhooks', requireRole('admin'), async (req, res) => {
  const baseUrl = process.env.SHOPIFY_WEBHOOK_BASE_URL;
  if (!baseUrl) {
    return res.status(400).json({
      message: 'SHOPIFY_WEBHOOK_BASE_URL lipsește în .env. Exemplu: https://abc123.ngrok-free.app',
      hint: 'Rulezi ngrok: ngrok http 5000 (sau PORT-ul backend)'
    });
  }

  const address = `${baseUrl.replace(/\/$/, '')}/api/webhooks/shopify`;

  try {
    const existing = await getWebhooks();
    const created = [];
    const skipped = [];

    for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
      if (webhookExists(topic, address, existing)) {
        skipped.push(topic);
        continue;
      }
      const wh = await createWebhook(topic, address);
      created.push({ id: wh.id, topic: wh.topic, address: wh.address });
    }

    res.json({
      success: true,
      created,
      skipped,
      message: created.length
        ? `Creat ${created.length} webhook(s). Skipped: ${skipped.join(', ') || '-'}`
        : `Toate webhooks existau deja. Skipped: ${skipped.join(', ')}`
    });
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    let msg = err.message;

    if (msg === 'Shop not connected. Please run /auth/shopify first.') {
      return res.status(400).json({ message: msg });
    }
    if (status === 403 || (data && /access|scope/i.test(JSON.stringify(data)))) {
      msg =
        'Scopes insuficiente. În Shopify: Dev Dashboard > Settings > API scopes > adaugă read_orders, write_orders (dacă e nevoie) > release new version > reinstall app.';
    }
    if (status === 401) {
      msg = 'Token invalid sau expirat. Reconectează shop-ul prin /auth/shopify.';
    }

    console.error('Setup webhooks error:', err.response?.data?.errors || err.message);
    res.status(status || 500).json({ message: msg, details: data });
  }
});

/** GET /api/webhooks - listează webhooks Shopify (admin only) */
router.get('/webhooks', requireRole('admin'), async (req, res) => {
  try {
    const webhooks = await getWebhooks();
    res.json(webhooks);
  } catch (err) {
    const status = err.response?.status;
    let msg = err.message;
    if (msg === 'Shop not connected. Please run /auth/shopify first.') {
      return res.status(400).json({ message: msg });
    }
    if (status === 403) {
      msg =
        'Scopes insuficiente. Adaugă read_orders (și write pentru create) în API scopes.';
    }
    if (status === 401) {
      msg = 'Token invalid. Reconectează shop-ul prin /auth/shopify.';
    }
    console.error('Get webhooks error:', err.response?.data?.errors || err.message);
    res.status(status || 500).json({ message: msg });
  }
});

/** POST /api/admin/backfill-delivery-date – backfill deliveryDate from raw payload (admin only) */
router.post('/admin/backfill-delivery-date', requireRole('admin'), async (req, res) => {
  const orders = await Order.find({});
  let updated = 0;
  for (const order of orders) {
    const { deliveryDate, deliveryOption } = extractDeliveryFromOrderDoc(order);
    if (!deliveryDate) continue;
    const changed = !order.deliveryDate || order.deliveryDate.getTime() !== deliveryDate.getTime();
    if (changed) {
      order.deliveryDate = deliveryDate;
      if (deliveryOption) order.deliveryOption = deliveryOption;
      await order.save();
      updated++;
    }
  }
  res.json({ success: true, total: orders.length, updated });
});

/** DELETE /api/webhooks/:id - șterge webhook (admin only) */
router.delete('/webhooks/:id', requireRole('admin'), async (req, res) => {
  try {
    await deleteWebhook(req.params.id);
    res.json({ success: true, message: 'Webhook șters' });
  } catch (err) {
    const status = err.response?.status;
    if (err.message === 'Shop not connected. Please run /auth/shopify first.') {
      return res.status(400).json({ message: err.message });
    }
    console.error('Delete webhook error:', err.response?.data?.errors || err.message);
    res.status(status || 500).json({ message: err.message });
  }
});

module.exports = router;
