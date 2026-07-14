const express = require('express');
const Order = require('../models/Order');
const { requireRole } = require('../middleware/auth');
const { buildDeliveryDateQuery } = require('../utils/deliveryFilter');
const {
  DEFAULT_FEE_PERCENT,
  DEFAULT_PLATFORM_PERCENT,
  FIXED_SHIPPING_DKK,
  getFinanceOptions,
  buildOrderFinanceRow,
  toPartnerFinanceView,
  aggregateFinanceWeek
} = require('../utils/orderFinance');

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

function isoDateOnly(date) {
  return new Date(date).toISOString().slice(0, 10);
}

async function loadWeeklyFinanceOrders({ partnerId, weekStart, weekEnd }) {
  const query = {
    status: { $ne: 'cancelled' },
    deliveryDate: { $gte: weekStart, $lte: weekEnd }
  };
  if (partnerId) query.partner = partnerId;

  return Order.find(query)
    .populate('partner', 'name email')
    .sort({ deliveryDate: 1, createdAt: 1 })
    .limit(5000);
}

function buildWeeklyFinanceReport(orders, reqQuery, { partnerView = false } = {}) {
  const options = getFinanceOptions(reqQuery);
  const fullRows = orders.map((o) => buildOrderFinanceRow(o, options));
  const rows = partnerView ? fullRows.map(toPartnerFinanceView) : fullRows;
  const summary = aggregateFinanceWeek(fullRows, partnerView);

  return {
    week: null,
    assumptions: {
      fixedShipping: FIXED_SHIPPING_DKK,
      feePercent: options.feeRate * 100,
      feeFixed: options.feeFixed,
      platformPercent: options.platformCutRate * 100
    },
    summary,
    orders: rows
  };
}

function startOfWeekMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const jsDay = d.getDay();
  const diff = (jsDay + 6) % 7; // Monday=0
  d.setDate(d.getDate() - diff);
  return d;
}

function endOfWeekSunday(weekStartDate) {
  const d = new Date(weekStartDate);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
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

// GET /api/reports/partner-weekly - simplified weekly finance report for partner
router.get('/partner-weekly', requireRole('partner'), async (req, res) => {
  const weekStartInput = req.query.weekStart ? new Date(String(req.query.weekStart)) : new Date();
  const weekStart = startOfWeekMonday(weekStartInput);
  const weekEnd = endOfWeekSunday(weekStart);

  const orders = await loadWeeklyFinanceOrders({ partnerId: req.user.id, weekStart, weekEnd });
  const report = buildWeeklyFinanceReport(orders, req.query, { partnerView: true });
  report.week = { from: isoDateOnly(weekStart), to: isoDateOnly(weekEnd) };

  res.json(report);
});

// GET /api/reports/partner-weekly.csv - partner CSV (no gross / Stripe fee)
router.get('/partner-weekly.csv', requireRole('partner'), async (req, res) => {
  const weekStartInput = req.query.weekStart ? new Date(String(req.query.weekStart)) : new Date();
  const weekStart = startOfWeekMonday(weekStartInput);
  const weekEnd = endOfWeekSunday(weekStart);

  const orders = await loadWeeklyFinanceOrders({ partnerId: req.user.id, weekStart, weekEnd });
  const report = buildWeeklyFinanceReport(orders, req.query, { partnerView: true });
  const rows = report.orders;

  const headers = [
    'OrderNumber',
    'DeliveryDate',
    'Status',
    'RecipientName',
    'Postcode',
    'City',
    'FlowersAfterProcessingDKK',
    'ShippingDKK',
    'PlatformFeeDKK',
    'YourPayoutDKK'
  ];

  const csvRows = rows.map((r) => [
    r.orderNumber,
    r.deliveryDate,
    r.status,
    r.recipientName,
    r.postcode,
    r.city,
    r.flowerValue.toFixed(2),
    r.shipping.toFixed(2),
    r.platformCommission.toFixed(2),
    r.partnerPayout.toFixed(2)
  ]);

  const csv = [headers.map(escapeCsv).join(',')]
    .concat(csvRows.map((r) => r.map(escapeCsv).join(',')))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=partner-weekly-${isoDateOnly(weekStart)}.csv`
  );
  res.send('\ufeff' + csv);
});

// GET /api/reports/admin-weekly - full weekly finance report for admin (optional partner filter)
router.get('/admin-weekly', requireRole('admin'), async (req, res) => {
  const weekStartInput = req.query.weekStart ? new Date(String(req.query.weekStart)) : new Date();
  const weekStart = startOfWeekMonday(weekStartInput);
  const weekEnd = endOfWeekSunday(weekStart);
  const partnerId = req.query.partnerId || null;

  const orders = await loadWeeklyFinanceOrders({ partnerId, weekStart, weekEnd });
  const report = buildWeeklyFinanceReport(orders, req.query, { partnerView: false });
  report.week = { from: isoDateOnly(weekStart), to: isoDateOnly(weekEnd) };

  res.json(report);
});

// GET /api/reports/admin-weekly.csv - full admin CSV export
router.get('/admin-weekly.csv', requireRole('admin'), async (req, res) => {
  const weekStartInput = req.query.weekStart ? new Date(String(req.query.weekStart)) : new Date();
  const weekStart = startOfWeekMonday(weekStartInput);
  const weekEnd = endOfWeekSunday(weekStart);
  const partnerId = req.query.partnerId || null;

  const orders = await loadWeeklyFinanceOrders({ partnerId, weekStart, weekEnd });
  const report = buildWeeklyFinanceReport(orders, req.query, { partnerView: false });
  const rows = report.orders;

  const headers = [
    'OrderNumber',
    'Partner',
    'DeliveryDate',
    'Status',
    'RecipientName',
    'Postcode',
    'City',
    'GrossDKK',
    'StripeFeeDKK',
    'NetAfterFeeDKK',
    'FlowersAfterFeeDKK',
    'ShippingDKK',
    'PlatformFeeDKK',
    'PartnerPayoutDKK'
  ];

  const csvRows = rows.map((r) => [
    r.orderNumber,
    r.partnerName,
    r.deliveryDate,
    r.status,
    r.recipientName,
    r.postcode,
    r.city,
    r.gross.toFixed(2),
    r.feeAmount.toFixed(2),
    r.netAfterFee.toFixed(2),
    r.flowerValue.toFixed(2),
    r.shipping.toFixed(2),
    r.platformCommission.toFixed(2),
    r.partnerPayout.toFixed(2)
  ]);

  const csv = [headers.map(escapeCsv).join(',')]
    .concat(csvRows.map((r) => r.map(escapeCsv).join(',')))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=admin-weekly-${isoDateOnly(weekStart)}.csv`
  );
  res.send('\ufeff' + csv);
});

module.exports = router;
