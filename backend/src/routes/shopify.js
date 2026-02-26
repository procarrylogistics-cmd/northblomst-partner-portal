const express = require('express');
const crypto = require('crypto');
const Order = require('../models/Order');
const User = require('../models/User');
const { matchZoneForPostalCode } = require('../utils/postalZone');
const { triggerZapierForOrder } = require('../services/zapier');

const router = express.Router();
// Raw body e montat la nivel app (server.js) înainte de express.json

/** Verificare HMAC-SHA256 cu timingSafeEqual. */
function verifyShopifyHmac(req) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256') || '';
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret || !Buffer.isBuffer(req.body)) return false;

  const computed = crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('base64');

  const bufA = Buffer.from(computed, 'utf8');
  const bufB = Buffer.from(hmacHeader, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Mapează payload Shopify la obiect Order. */
function mapShopifyPayloadToOrder(data) {
  const products = (data.line_items || []).map((item) => ({
    sku: item.sku,
    name: item.name,
    quantity: item.quantity,
    notes: (item.properties && item.properties.note) ? item.properties.note : ''
  }));
  const shipping = data.shipping_address || {};
  const customer = {
    name: `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() ||
      `${(data.customer && data.customer.first_name) || ''} ${(data.customer && data.customer.last_name) || ''}`.trim(),
    phone: shipping.phone || (data.customer && data.customer.phone) || '',
    email: data.email || (data.customer && data.customer.email) || '',
    message: (data.note || '').toString()
  };
  const shippingAddress = {
    address1: shipping.address1,
    address2: shipping.address2,
    postalCode: shipping.zip,
    city: shipping.city,
    country: shipping.country
  };
  const zone = matchZoneForPostalCode(shipping.zip);
  const orderDate = data.created_at ? new Date(data.created_at) : new Date();
  const deliveryDate = data.estimated_delivery_at ? new Date(data.estimated_delivery_at) : orderDate;

  return {
    shopifyOrderId: String(data.id),
    shopifyOrderNumber: String(data.order_number || data.number || ''),
    shopifyOrderName: data.name,
    orderDate,
    deliveryDate,
    products,
    customer,
    shippingAddress,
    zone,
    status: 'new',
    createdByRole: 'shopify'
  };
}

/** Auto-asignează partner pe bază de zone/postal. */
async function assignPartnerIfMatch(order) {
  const zone = order.zone;
  if (!zone) return null;
  const partners = await User.find({ role: 'partner' });
  const postal = String(order.shippingAddress?.postalCode || '');
  const numericPostal = parseInt(postal, 10);

  for (const p of partners) {
    if (!Array.isArray(p.zoneRanges)) continue;
    for (const zoneRange of p.zoneRanges) {
      if (zoneRange.includes('-')) {
        const [startStr, endStr] = zoneRange.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!Number.isNaN(start) && !Number.isNaN(end) && numericPostal >= start && numericPostal <= end) {
          return p;
        }
      } else {
        const exact = parseInt(zoneRange, 10);
        if (!Number.isNaN(exact) && exact === numericPostal) return p;
      }
    }
  }
  return null;
}

// Handler principal: orders/create, orders/updated, orders/cancelled (X-Shopify-Topic)
router.post('/', async (req, res) => {
  if (!verifyShopifyHmac(req)) {
    return res.status(401).send('Invalid HMAC');
  }

  const topic = req.get('X-Shopify-Topic') || '';
  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch (e) {
    console.error('Shopify webhook: invalid JSON', e);
    return res.status(400).send('Invalid JSON');
  }

  // Răspunde 200 OK imediat; procesare async
  res.status(200).send('ok');

  setImmediate(async () => {
    try {
      if (topic === 'orders/create') {
        const existing = await Order.findOne({ shopifyOrderId: String(payload.id) });
        if (existing) {
          console.log('Shopify orders/create: order already exists', payload.id);
          return;
        }
        const orderData = mapShopifyPayloadToOrder(payload);
        const order = await Order.create(orderData);
        const partner = await assignPartnerIfMatch(order);
        if (partner) {
          order.partner = partner._id;
          await order.save();
          triggerZapierForOrder(order, partner).catch((err) => console.error('Zapier trigger failed', err));
        }
        console.log('Shopify orders/create: created order', order._id, payload.id);
      } else if (topic === 'orders/updated') {
        const order = await Order.findOne({ shopifyOrderId: String(payload.id) });
        if (!order) {
          console.log('Shopify orders/updated: order not found', payload.id);
          return;
        }
        if (payload.note) order.notes = payload.note;
        if (payload.fulfillments && payload.fulfillments.length) {
          const f = payload.fulfillments[payload.fulfillments.length - 1];
          if (f.tracking_number) order.trackingNumber = f.tracking_number;
          if (f.tracking_urls && f.tracking_urls[0]) order.trackingUrl = f.tracking_urls[0];
        }
        if (payload.fulfillment_status === 'fulfilled') order.status = 'fulfilled';
        order.updatedAt = new Date();
        await order.save();
        console.log('Shopify orders/updated: updated order', order._id);
      } else if (topic === 'orders/cancelled') {
        const order = await Order.findOne({ shopifyOrderId: String(payload.id) });
        if (!order) {
          console.log('Shopify orders/cancelled: order not found', payload.id);
          return;
        }
        order.status = 'cancelled';
        order.cancelledAt = payload.cancelled_at ? new Date(payload.cancelled_at) : new Date();
        order.cancelReason = payload.cancel_reason || '';
        order.updatedAt = new Date();
        await order.save();
        console.log('Shopify orders/cancelled: cancelled order', order._id);
      } else {
        console.log('Shopify webhook: unhandled topic', topic);
      }
    } catch (err) {
      console.error('Shopify webhook processing error:', err);
    }
  });
});

// Legacy: order-paid (topic diferit, poate fi folosit în paralel)
router.post('/order-paid', async (req, res) => {
  if (!verifyShopifyHmac(req)) {
    return res.status(401).send('Invalid HMAC');
  }

  const data = JSON.parse(req.body.toString('utf8'));

  const existing = await Order.findOne({ shopifyOrderId: data.id });
  if (existing) {
    return res.status(200).send('Order already ingested');
  }

  const products = (data.line_items || []).map((item) => ({
    sku: item.sku,
    name: item.name,
    quantity: item.quantity,
    notes: item.properties && item.properties.note ? item.properties.note : ''
  }));

  const shipping = data.shipping_address || {};
  const customer = {
    name: `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() ||
      `${data.customer?.first_name || ''} ${data.customer?.last_name || ''}`.trim(),
    phone: shipping.phone || data.customer?.phone || '',
    email: data.email || data.customer?.email || '',
    message: (data.note || '').toString()
  };

  const shippingAddress = {
    address1: shipping.address1,
    address2: shipping.address2,
    postalCode: shipping.zip,
    city: shipping.city,
    country: shipping.country
  };

  const zone = matchZoneForPostalCode(shipping.zip);
  const orderDate = data.created_at ? new Date(data.created_at) : new Date();
  const deliveryDate = data.estimated_delivery_at
    ? new Date(data.estimated_delivery_at)
    : orderDate;

  const order = await Order.create({
    shopifyOrderId: String(data.id),
    shopifyOrderNumber: String(data.order_number || data.number),
    shopifyOrderName: data.name,
    orderDate,
    deliveryDate,
    products,
    customer,
    shippingAddress,
    zone,
    status: 'new'
  });

  // Auto-route to partner based on postal / partner zoneRanges
  if (zone) {
    const partners = await User.find({ role: 'partner' });
    const postal = String(shipping.zip || '');
    const numericPostal = parseInt(postal, 10);

    let matchedPartner = null;
    for (const p of partners) {
      if (!Array.isArray(p.zoneRanges)) continue;
      for (const zoneRange of p.zoneRanges) {
        if (zoneRange.includes('-')) {
          const [startStr, endStr] = zoneRange.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (!Number.isNaN(start) && !Number.isNaN(end) && numericPostal >= start && numericPostal <= end) {
            matchedPartner = p;
            break;
          }
        } else {
          const exact = parseInt(zoneRange, 10);
          if (!Number.isNaN(exact) && exact === numericPostal) {
            matchedPartner = p;
            break;
          }
        }
      }
      if (matchedPartner) break;
    }

    if (matchedPartner) {
      order.partner = matchedPartner._id;
      await order.save();
      triggerZapierForOrder(order, matchedPartner).catch((err) =>
        console.error('Zapier trigger failed', err)
      );
    }
  }

  res.status(200).send('ok');
});

module.exports = router;

