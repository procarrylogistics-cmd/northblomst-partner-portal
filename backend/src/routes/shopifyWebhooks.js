/**
 * Shopify webhook receiver – orders/create.
 * Validates HMAC, parses payload, upserts Order in Mongo.
 */

const express = require('express');
const crypto = require('crypto');
const Order = require('../models/Order');
const ShopifyStore = require('../models/ShopifyStore');
const { summarizeOrderForDebug, extractAddOnsFromShopifyOrder } = require('../utils/addonExtractor');
const { extractDeliveryFromShopifyOrder } = require('../utils/deliveryDateExtractor');
const { enrichOrderImages } = require('../services/orderImageEnricher');

const router = express.Router();
const DEBUG_WEBHOOK_PAYLOAD = process.env.DEBUG_WEBHOOK_PAYLOAD === 'true';

/** GET /webhooks/ping – quick reachability check */
router.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

function mapWebhookPayloadToOrder(payload, effectiveShop) {
  const { addOns, addOnsSummary } = extractAddOnsFromShopifyOrder(payload);
  const { deliveryDate: extractedDate, deliveryOption } = extractDeliveryFromShopifyOrder(payload);
  const ship = payload.shipping_address || {};
  const cust = payload.customer || {};
  const customerName =
    ship.name || `${(ship.first_name || '')} ${(ship.last_name || '')}`.trim() ||
    `${(cust.first_name || '')} ${(cust.last_name || '')}`.trim() || '';
  const email = payload.email || cust.email || '';
  const phone = ship.phone || cust.phone || '';
  const products = (payload.line_items || []).map((li) => ({
    sku: li.sku,
    name: li.title || li.name,
    quantity: li.quantity || 1,
    productId: li.product_id != null ? String(li.product_id) : undefined,
    variantId: li.variant_id != null ? String(li.variant_id) : undefined
  }));
  return {
    shop: effectiveShop,
    shopifyOrderId: payload.id != null ? String(payload.id) : null,
    shopifyOrderName: payload.name,
    shopifyOrderNumber: payload.order_number != null ? String(payload.order_number) : undefined,
    receivedAt: payload.created_at ? new Date(payload.created_at) : new Date(),
    orderDate: payload.created_at ? new Date(payload.created_at) : new Date(),
    deliveryDate: extractedDate || (payload.estimated_delivery_at ? new Date(payload.estimated_delivery_at) : new Date(payload.created_at || Date.now())),
    deliveryOption: deliveryOption || undefined,
    status: 'new',
    partner: null,
    createdByRole: 'shopify',
    recipientName: customerName,
    phone,
    customer: { name: customerName, email, phone, message: payload.note || '' },
    shippingAddress: {
      address1: ship.address1,
      address2: ship.address2,
      postalCode: ship.zip,
      city: ship.city,
      country: ship.country
    },
    address: ship.address1,
    postcode: ship.zip,
    city: ship.city,
    notes: payload.note,
    tags: payload.tags,
    products,
    addOns,
    addOnsSummary,
    totalPrice: payload.total_price,
    totalPaidAmount: payload.total_price != null ? parseFloat(payload.total_price) : undefined,
    currencyCode: payload.currency || undefined,
    raw: {
      id: payload.id,
      name: payload.name,
      created_at: payload.created_at,
      email: payload.email,
      order_number: payload.order_number,
      note_attributes: payload.note_attributes,
      line_items: (payload.line_items || []).map((li) => ({ properties: li.properties })),
      estimated_delivery_at: payload.estimated_delivery_at
    }
  };
}

/**
 * POST /webhooks/orders_create
 * Validates HMAC, parses payload, upserts Order. Returns 200 fast.
 */
router.post('/orders_create', async (req, res) => {
  const received = req.get('x-shopify-hmac-sha256') || '';
  const secret = (process.env.SHOPIFY_WEBHOOK_SECRET || '').trim();

  if (!secret) {
    return res.status(500).send('SHOPIFY_WEBHOOK_SECRET not configured');
  }
  if (!Buffer.isBuffer(req.body)) {
    console.error('WEBHOOK HMAC FAIL', { bodyIsBuffer: false, contentType: req.get('content-type') });
    return res.status(400).send('Invalid body');
  }

  const computed = crypto.createHmac('sha256', secret).update(req.body).digest('base64');
  const bufA = Buffer.from(computed, 'utf8');
  const bufB = Buffer.from(received, 'utf8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    console.error('WEBHOOK HMAC FAIL', { bodyIsBuffer: true, bodyLength: req.body.length });
    return res.status(401).send('Invalid webhook signature');
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch (e) {
    return res.status(400).send('Invalid JSON');
  }

  if (DEBUG_WEBHOOK_PAYLOAD) {
    const summary = summarizeOrderForDebug(payload);
    console.log('WEBHOOK DEBUG payload summary', JSON.stringify(summary, null, 0).slice(0, 1500));
  }

  const shop = (req.get('x-shopify-shop-domain') || payload.shop_domain || process.env.SHOPIFY_SHOP || '').trim();
  const shopifyOrderId = payload.id != null ? String(payload.id) : null;
  const name = payload.name || (payload.order_number ? `#${payload.order_number}` : '');

  res.status(200).send('OK');

  setImmediate(async () => {
    try {
      let effectiveShop = shop;
      if (!effectiveShop) {
        const store = await ShopifyStore.findOne().sort({ installedAt: -1 });
        effectiveShop = store?.shop || '';
      }
      if (!effectiveShop || !shopifyOrderId) {
        console.error('Webhook orders/create: missing shop or shopifyOrderId');
        return;
      }

      const doc = mapWebhookPayloadToOrder(payload, effectiveShop);

      const saved = await Order.findOneAndUpdate(
        { shop: effectiveShop, shopifyOrderId },
        { $set: doc },
        { upsert: true, new: true }
      );

      setImmediate(() => {
        enrichOrderImages(saved).catch((err) => console.error('Webhook image enrichment failed', err.message));
      });

      const addOnCount = (doc.addOns || []).length;
      console.log('order saved', { shop: effectiveShop, shopifyOrderId, name, addOns: addOnCount });
      if (addOnCount === 0) {
        if (DEBUG_WEBHOOK_PAYLOAD) {
          const summary = summarizeOrderForDebug(payload);
          console.log('WEBHOOK addons=0, payload:', JSON.stringify(summary).slice(0, 2000));
        }
      }
    } catch (err) {
      console.error('Webhook orders/create processing error', err.message);
    }
  });
});

module.exports = router;
