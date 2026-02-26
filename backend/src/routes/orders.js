const express = require('express');
const Order = require('../models/Order');
const User = require('../models/User');
const { requireRole } = require('../middleware/auth');
const { triggerZapierForOrder } = require('../services/zapier');
const { sendOrderAssignedToPartner, sendStatusChangeToAdmin } = require('../services/email');
const { buildDeliveryDateQuery } = require('../utils/deliveryFilter');
const { getOrders: getShopifyOrders, addFulfillment } = require('../utils/shopifyProxy');
const { matchZoneForPostalCode } = require('../utils/postalZone');

const router = express.Router();

/** Mapează ordine Shopify la document Order (Mongo). */
function mapShopifyOrderToDoc(shopifyOrder) {
  const shipping = shopifyOrder.shipping_address || {};
  const products = (shopifyOrder.line_items || []).map((li) => ({
    sku: li.sku,
    name: li.name,
    quantity: li.quantity,
    notes: (li.properties && li.properties.note) ? li.properties.note : ''
  }));
  const customer = {
    name: `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() ||
      `${(shopifyOrder.customer && shopifyOrder.customer.first_name) || ''} ${(shopifyOrder.customer && shopifyOrder.customer.last_name) || ''}`.trim(),
    phone: shipping.phone || (shopifyOrder.customer && shopifyOrder.customer.phone) || '',
    email: shopifyOrder.email || (shopifyOrder.customer && shopifyOrder.customer.email) || '',
    message: (shopifyOrder.note || '').toString()
  };
  const shippingAddress = {
    address1: shipping.address1,
    address2: shipping.address2,
    postalCode: shipping.zip,
    city: shipping.city,
    country: shipping.country
  };
  const zone = matchZoneForPostalCode(shipping.zip);
  const orderDate = shopifyOrder.created_at ? new Date(shopifyOrder.created_at) : new Date();
  const deliveryDate = shopifyOrder.estimated_delivery_at ? new Date(shopifyOrder.estimated_delivery_at) : orderDate;

  return {
    shopifyOrderId: String(shopifyOrder.id),
    shopifyOrderNumber: String(shopifyOrder.order_number || shopifyOrder.number || ''),
    shopifyOrderName: shopifyOrder.name,
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

/** Auto-asignează partner după zonă/postal. */
async function assignPartnerIfMatch(order) {
  const zone = order.zone;
  if (!zone) return null;
  const partners = await User.find({ role: 'partner' });
  const postal = String(order.shippingAddress?.postalCode || '');
  const numericPostal = parseInt(postal, 10);
  for (const p of partners) {
    if (!Array.isArray(p.zoneRanges)) continue;
    for (const zr of p.zoneRanges) {
      if (zr.includes('-')) {
        const [s, e] = zr.split('-').map(Number);
        if (!Number.isNaN(s) && !Number.isNaN(e) && numericPostal >= s && numericPostal <= e) return p;
      } else {
        const ex = parseInt(zr, 10);
        if (!Number.isNaN(ex) && ex === numericPostal) return p;
      }
    }
  }
  return null;
}

// Admin: list all orders with filters
router.get('/admin', requireRole('admin'), async (req, res) => {
  const { status, postalCode, partnerId, deliveryPreset, deliveryDate, from, to } = req.query;
  const query = {};

  if (status) query.status = status;
  if (postalCode) query.$or = [
    { 'shippingAddress.postalCode': postalCode },
    { postcode: postalCode }
  ];
  if (partnerId) query.partner = partnerId;

  const deliveryQuery = buildDeliveryDateQuery(deliveryPreset, deliveryDate, from, to);
  if (deliveryQuery) Object.assign(query, deliveryQuery);

  const orders = await Order.find(query)
    .populate('partner', 'name email')
    .sort({ deliveryDate: 1, createdAt: 1 })
    .limit(200);

  res.json(orders);
});

// Admin: sync ordine din Shopify prin proxy (înainte de /:id)
router.get('/sync-from-shopify', requireRole('admin'), async (req, res) => {
  const result = await getShopifyOrders({ limit: 20, status: 'any' });
  if (!result.success) {
    const errMsg = result.error || 'Proxy-ul Shopify nu răspunde';
    const isConnectionError = /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|fetch failed/i.test(String(errMsg));
    const message = isConnectionError
      ? 'Shopify CLI nu rulează sau portul s-a schimbat. 1) Pornește în terminal: cd profitable-vertical-app && shopify app dev --store=northblomst-dev.myshopify.com --use-localhost --localhost-port=3456. 2) Pune în .env: SHOPIFY_PROXY_URL=http://localhost:3456. 3) Restart backend.'
      : errMsg;
    return res.status(502).json({ success: false, message });
  }
  const shopifyOrders = result.data || [];
  let synced = 0;
  for (const so of shopifyOrders) {
    const existing = await Order.findOne({ shopifyOrderId: String(so.id) });
    if (existing) continue;
    const doc = mapShopifyOrderToDoc(so);
    const order = await Order.create(doc);
    const partner = await assignPartnerIfMatch(order);
    if (partner) {
      order.partner = partner._id;
      await order.save();
      triggerZapierForOrder(order, partner).catch((err) => console.error('Zapier trigger failed', err));
    }
    synced++;
  }
  res.json({ success: true, synced });
});

// Admin or Partner: create manual order (phone orders) - must be before /:id
router.post('/manual', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  const role = String(req.user.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'partner') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const user = req.user;
  const data = req.body || {};
  const partnerId = role === 'partner' ? user.id : (data.partnerId || null);

  const deliveryDateVal = data.deliveryDate ? new Date(data.deliveryDate) : new Date();
  const receivedAt = new Date();
  const orderNumber = await ensureUniqueOrderNumber();

  const createdByRole = role === 'partner' ? 'partner' : 'admin';
  const createdByPartnerId = role === 'partner' ? user.id : null;
  const createdByEmail = user.email || '';

  const orderData = {
    orderNumber,
    receivedAt,
    shopifyOrderId: null,
    shopifyOrderNumber: orderNumber,
    shopifyOrderName: `#${orderNumber}`,
    orderDate: receivedAt,
    deliveryDate: deliveryDateVal,
    status: 'new',
    recipientName: data.recipientName || '',
    address: data.address || '',
    postcode: data.postcode || '',
    city: data.city || '',
    phone: data.phone || '',
    cardFlag: !!data.cardFlag,
    cardText: data.cardText || '',
    notes: data.notes || '',
    productSummary: data.productSummary || '',
    products: data.products || [],
    customer: data.recipientName ? { name: data.recipientName, phone: data.phone } : {},
    shippingAddress: data.address ? { address1: data.address, postalCode: data.postcode, city: data.city } : {},
    zone: data.zone || null,
    partner: partnerId,
    createdByRole,
    createdByPartnerId,
    createdByEmail,
    trackingUrl: '',
    trackingNumber: ''
  };

  const order = await Order.create(orderData);
  res.status(201).json(order);
});

// Partner: list own orders
router.get('/my', async (req, res) => {
  const user = req.user;
  if (!user || user.role !== 'partner') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { status, deliveryPreset, deliveryDate, from, to } = req.query;
  const query = { partner: user.id };
  if (status) query.status = status;

  const deliveryQuery = buildDeliveryDateQuery(deliveryPreset, deliveryDate, from, to);
  if (deliveryQuery) Object.assign(query, deliveryQuery);

  const orders = await Order.find(query)
    .sort({ deliveryDate: 1, createdAt: 1 })
    .limit(200);
  res.json(orders);
});

// Get single order (admin or assigned partner)
router.get('/:id', async (req, res) => {
  const order = await Order.findById(req.params.id).populate('partner', 'name email');
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  if (req.user.role === 'partner' && (!order.partner || String(order.partner._id) !== String(req.user.id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  res.json(order);
});

function canEditOrder(order, user) {
  if (!order || !user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'partner' && order.partner && String(order.partner._id || order.partner) === String(user.id)) return true;
  return false;
}

// PATCH /api/orders/:id - edit order (admin or assigned partner)
router.patch('/:id', async (req, res) => {
  const order = await Order.findById(req.params.id).populate('partner');
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (!canEditOrder(order, req.user)) return res.status(403).json({ message: 'Forbidden' });
  if (order.status === 'cancelled') return res.status(400).json({ message: 'Cannot edit cancelled order' });

  const data = req.body || {};
  const editable = ['recipientName', 'address', 'postcode', 'city', 'phone', 'deliveryDate', 'cardFlag', 'cardText', 'notes', 'productSummary'];
  const changes = [];
  editable.forEach((f) => {
    if (data[f] !== undefined) {
      const val = f === 'deliveryDate' && data[f] ? new Date(data[f]) : data[f];
      if (f === 'cardFlag') order[f] = !!val;
      else if (f === 'cardText' || f === 'notes' || f === 'productSummary') order[f] = String(val || '').trim();
      else order[f] = val;
      changes.push(f);
    }
  });
  if (order.recipientName) order.customer = { ...order.customer, name: order.recipientName, phone: order.phone };
  if (order.address) order.shippingAddress = { address1: order.address, postalCode: order.postcode, city: order.city };

  order.updatedAt = new Date();
  order.updatedByRole = req.user.role;
  order.updatedByEmail = req.user.email || '';
  order.updateCount = (order.updateCount || 0) + 1;
  if (changes.length) order.lastUpdatedFields = changes;
  await order.save();

  res.json(order);
});

// PATCH /api/orders/:id/cancel
router.patch('/:id/cancel', async (req, res) => {
  const order = await Order.findById(req.params.id).populate('partner');
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (!canEditOrder(order, req.user)) return res.status(403).json({ message: 'Forbidden' });

  order.status = 'cancelled';
  order.cancelledAt = new Date();
  order.cancelledByRole = req.user.role;
  order.cancelledByEmail = req.user.email || '';
  order.cancelReason = (req.body?.reason || '').trim();
  order.updatedAt = new Date();
  order.updatedByRole = req.user.role;
  order.updatedByEmail = req.user.email || '';
  order.updateCount = (order.updateCount || 0) + 1;
  await order.save();

  res.json(order);
});

// Partner/Admin: update status
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['new', 'in_production', 'ready', 'fulfilled', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const order = await Order.findById(req.params.id).populate('partner');
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  if (req.user.role === 'partner') {
    if (!order.partner || String(order.partner._id) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  order.status = status;
  await order.save();

  // Notify admin of status change (async, non-blocking)
  if (['in_production', 'ready', 'fulfilled'].includes(status)) {
    sendStatusChangeToAdmin(order, status).catch((err) =>
      console.error('Status notification email failed', err)
    );
  }

  res.json(order);
});

function generateOrderNumber() {
  return String(Math.floor(1000000 + Math.random() * 9000000));
}

async function ensureUniqueOrderNumber() {
  let num;
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 20) {
    num = generateOrderNumber();
    const found = await Order.findOne({ orderNumber: num });
    exists = !!found;
    attempts++;
  }
  return num;
}

// Admin: assign order to partner (manual override)
router.patch('/:id/assign', requireRole('admin'), async (req, res) => {
  const { partnerId } = req.body;
  if (!partnerId) {
    return res.status(400).json({ message: 'partnerId required' });
  }

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const partner = await User.findById(partnerId);
  if (!partner || partner.role !== 'partner') {
    return res.status(404).json({ message: 'Partner not found' });
  }

  order.partner = partner._id;
  await order.save();

  // Trigger Zapier / TrackPOD
  triggerZapierForOrder(order, partner).catch((err) =>
    console.error('Zapier trigger failed', err)
  );

  // Email partner about new assignment (async, non-blocking)
  sendOrderAssignedToPartner(partner, order).catch((err) =>
    console.error('Order assignment email failed', err)
  );

  res.json(order);
});

// Admin / Partner: set tracking info manual (doar în DB)
router.patch('/:id/tracking', async (req, res) => {
  const { trackingUrl, trackingNumber } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (req.user.role === 'partner' && (!order.partner || String(order.partner) !== String(req.user.id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (trackingUrl) order.trackingUrl = trackingUrl;
  if (trackingNumber) order.trackingNumber = trackingNumber;
  await order.save();
  res.json(order);
});

// Admin / Partner: POST tracking – trimite și în Shopify prin proxy, apoi update DB
router.post('/:id/tracking', async (req, res) => {
  const { trackingNumber, trackingUrl } = req.body || {};
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (req.user.role === 'partner' && (!order.partner || String(order.partner) !== String(req.user.id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (!order.shopifyOrderId) {
    // Ordine fără Shopify – doar update în DB
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (trackingUrl) order.trackingUrl = trackingUrl;
    await order.save();
    return res.json(order);
  }
  const result = await addFulfillment(order.shopifyOrderId, trackingNumber || '', trackingUrl || '');
  if (!result.success) {
    return res.status(502).json({
      message: result.error || 'Proxy Shopify nu răspunde. Pornește `shopify app dev`.'
    });
  }
  if (trackingNumber) order.trackingNumber = trackingNumber;
  if (trackingUrl) order.trackingUrl = trackingUrl;
  await order.save();
  res.json(order);
});

module.exports = router;

