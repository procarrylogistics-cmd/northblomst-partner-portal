const express = require('express');
const Order = require('../models/Order');
const { requireRole } = require('../middleware/auth');
const { buildDeliveryDateQuery } = require('../utils/deliveryFilter');

const router = express.Router();

function escapeCsv(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function getDeliveryQuery(deliveryPreset, deliveryDate, from, to) {
  return buildDeliveryDateQuery(deliveryPreset, deliveryDate, from, to);
}

function buildReceivedAtQuery(from, to) {
  if (!from && !to) return null;
  const gte = from ? new Date(from + 'T00:00:00.000Z') : null;
  let lt = null;
  if (to) {
    const toDate = new Date(to + 'T00:00:00.000Z');
    toDate.setUTCDate(toDate.getUTCDate() + 1);
    lt = toDate;
  }
  const q = {};
  if (gte) q.$gte = gte;
  if (lt) q.$lt = lt;
  if (Object.keys(q).length === 0) return null;
  return {
    $or: [
      { receivedAt: q },
      { receivedAt: { $exists: false }, createdAt: q }
    ]
  };
}

// GET /api/reports/orders - JSON summary + orders (admin only)
router.get('/orders', requireRole('admin'), async (req, res) => {
  const { deliveryPreset, deliveryDate, from, to, partnerId, status } = req.query;
  const query = {};

  const receivedQuery = buildReceivedAtQuery(from, to);
  if (receivedQuery) Object.assign(query, receivedQuery);
  const deliveryQuery = getDeliveryQuery(deliveryPreset, deliveryDate, null, null);
  if (deliveryQuery) Object.assign(query, deliveryQuery);
  if (partnerId) query.partner = partnerId;
  if (status) query.status = status;

  const orders = await Order.find(query)
    .populate('partner', 'name email')
    .sort({ deliveryDate: 1, createdAt: 1 })
    .limit(1000);

  const fulfilledCount = orders.filter((o) => o.status === 'fulfilled').length;
  const summary = {
    total: orders.length,
    deliveredStops: fulfilledCount,
    fulfilled: fulfilledCount,
    in_production: orders.filter((o) => o.status === 'in_production').length,
    ready: orders.filter((o) => o.status === 'ready').length,
    new: orders.filter((o) => o.status === 'new').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
    byStatus: {}
  };
  orders.forEach((o) => {
    summary.byStatus[o.status] = (summary.byStatus[o.status] || 0) + 1;
  });

  res.json({ summary, orders });
});

// GET /api/reports/orders.csv - CSV download (admin only)
router.get('/orders.csv', requireRole('admin'), async (req, res) => {
  const { deliveryPreset, deliveryDate, from, to, partnerId, status } = req.query;
  const query = {};

  const receivedQuery = buildReceivedAtQuery(from, to);
  if (receivedQuery) Object.assign(query, receivedQuery);
  const deliveryQuery = getDeliveryQuery(deliveryPreset, deliveryDate, null, null);
  if (deliveryQuery) Object.assign(query, deliveryQuery);
  if (partnerId) query.partner = partnerId;
  if (status) query.status = status;

  const orders = await Order.find(query)
    .populate('partner', 'name email')
    .sort({ deliveryDate: 1, createdAt: 1 })
    .limit(5000);

  const headers = [
    'OrderNumber',
    'PartnerName',
    'Status',
    'ReceivedAt',
    'DeliveryDate',
    'RecipientName',
    'Address',
    'Postcode',
    'City',
    'Phone',
    'CardFlag',
    'CardText',
    'ProductSummary',
    'CreatedByRole',
    'CreatedByEmail',
    'UpdatedAt',
    'UpdatedByRole',
    'UpdatedByEmail',
    'UpdateCount',
    'CancelledAt',
    'CancelReason'
  ];

  const formatDate = (d) => (d ? new Date(d).toISOString().slice(0, 19) : '');
  const formatDateOnly = (d) => (d ? new Date(d).toISOString().split('T')[0] : '');

  const rows = orders.map((o) => {
    const orderNum = o.orderNumber || o.shopifyOrderNumber || o.shopifyOrderName || o._id;
    const recipient = o.recipientName || o.customer?.name || '';
    const addr = o.address || o.shippingAddress?.address1 || '';
    const pc = o.postcode || o.shippingAddress?.postalCode || '';
    const cityVal = o.city || o.shippingAddress?.city || '';
    const phoneVal = o.phone || o.customer?.phone || '';
    const productSummary = o.productSummary || (o.products || [])
      .map((p) => `${p.quantity}x ${p.name}`)
      .join('; ');
    return [
      orderNum,
      o.partner?.name || '',
      o.status || '',
      formatDate(o.receivedAt || o.createdAt),
      formatDateOnly(o.deliveryDate),
      recipient,
      addr,
      pc,
      cityVal,
      phoneVal,
      o.cardFlag ? 'Yes' : 'No',
      o.cardText || '',
      productSummary,
      o.createdByRole || '',
      o.createdByEmail || '',
      formatDate(o.updatedAt),
      o.updatedByRole || '',
      o.updatedByEmail || '',
      o.updateCount ?? '',
      formatDate(o.cancelledAt),
      o.cancelReason || ''
    ];
  });

  const csv = [headers.map(escapeCsv).join(',')]
    .concat(rows.map((r) => r.map(escapeCsv).join(',')))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=orders-export.csv');
  res.send('\ufeff' + csv);
});

module.exports = router;
