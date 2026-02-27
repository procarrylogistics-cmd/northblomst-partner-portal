/**
 * Shopify webhook receiver – orders/create.
 * Uses SHOPIFY_WEBHOOK_SECRET (Webhook Signing Secret from Shopify Admin).
 */

const express = require('express');
const crypto = require('crypto');
const OrderRecord = require('../models/OrderRecord');
const { fetchOrderFromShopify, mapOrderDetails, buildPrintableData } = require('../services/shopifyOrder');

const router = express.Router();

/** GET /webhooks/ping – quick reachability check */
router.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

/**
 * POST /webhooks/orders_create
 * Validates HMAC, extracts shop/orderId, returns 200 fast.
 * Uses setImmediate to fetch order from Shopify and save to Mongo.
 */
router.post('/orders_create', async (req, res) => {
  const received = req.get('x-shopify-hmac-sha256') || '';
  const secret = (process.env.SHOPIFY_WEBHOOK_SECRET || '').trim();

  if (!secret) {
    return res.status(500).send('SHOPIFY_WEBHOOK_SECRET not configured');
  }
  if (!Buffer.isBuffer(req.body)) {
    console.error('WEBHOOK HMAC FAIL', { received, bodyIsBuffer: false, contentType: req.get('content-type') });
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
      bodyIsBuffer: true,
      bodyLength: req.body.length,
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

  const shop = (req.get('x-shopify-shop-domain') || (payload.shop_domain) || '').trim();
  const orderId = payload.id ? parseInt(String(payload.id), 10) : null;
  const orderGid = payload.admin_graphql_api_id || null;
  const name = payload.name || (orderId ? `#${orderId}` : '');
  const createdAt = payload.created_at ? new Date(payload.created_at) : new Date();

  res.status(200).send('OK');

  setImmediate(async () => {
    try {
      let effectiveShop = shop;
      if (!effectiveShop) {
        const ShopifyStore = require('../models/ShopifyStore');
        const store = await ShopifyStore.findOne().sort({ installedAt: -1 });
        effectiveShop = store?.shop || '';
      }
      if (!effectiveShop || !orderId) {
        console.error('Webhook orders/create: missing shop or orderId', { shop: effectiveShop, orderId });
        return;
      }

      const result = await fetchOrderFromShopify(effectiveShop, orderId);
      if (!result.success) {
        console.error('Webhook: failed to fetch order from Shopify', { shop: effectiveShop, orderId, error: result.error });
        return;
      }

      const orderDetails = mapOrderDetails(result.data);
      const printableData = buildPrintableData(orderDetails);

      const raw = {
        payload: { id: payload.id, name: payload.name, created_at: payload.created_at, email: payload.email },
        orderDetails
      };

      await OrderRecord.findOneAndUpdate(
        { shop: effectiveShop, orderId },
        {
          shop: effectiveShop,
          orderId,
          orderGid: orderGid || orderDetails?.id,
          name: name || orderDetails?.name || `#${orderId}`,
          createdAt: createdAt || (orderDetails?.createdAt ? new Date(orderDetails.createdAt) : new Date()),
          raw,
          status: 'NEW',
          assignedPartnerId: null,
          printableData
        },
        { upsert: true, new: true }
      );

      console.log('order saved', { shop: effectiveShop, orderId, name: name || orderDetails?.name });
    } catch (err) {
      console.error('Webhook orders/create processing error', err);
    }
  });
});

module.exports = router;
