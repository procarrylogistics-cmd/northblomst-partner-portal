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

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

function isoDateOnly(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function extractShippingAmount(order) {
  const raw = order?.raw || {};
  const fromSet = raw?.total_shipping_price_set?.shop_money?.amount;
  if (fromSet != null) return toNumber(fromSet, 0);
  const fromLines = raw?.shipping_lines?.[0]?.price;
  if (fromLines != null) return toNumber(fromLines, 0);
  return 0;
}

function orderDisplayNumber(order) {
  return order.orderNumber || order.shopifyOrderName || order.shopifyOrderNumber || String(order._id);
}

function buildPartnerFinanceRow(order, options) {
  const gross = toNumber(order.totalPaidAmount ?? order.totalPrice, 0);
  const shipping = Math.max(0, extractShippingAmount(order));
  const feeAmount = Math.max(0, gross * options.feeRate + options.feeFixed);
  const netAfterFee = Math.max(0, gross - feeAmount);
  const flowerValue = Math.max(0, netAfterFee - shipping);
  const platformCommission = Math.max(0, flowerValue * options.platformCutRate);
  const partnerPayout = Math.max(0, netAfterFee - platformCommission);
  const deliveryDate = order.deliveryDate || order.createdAt;

  return {
    orderId: String(order._id),
    orderNumber: orderDisplayNumber(order),
    deliveryDate: deliveryDate ? isoDateOnly(deliveryDate) : '',
    deliveryDateRaw: deliveryDate,
    weekday: deliveryDate ? new Date(deliveryDate).getDay() : null,
    status: order.status || '',
    recipientName: order.recipientName || order.customer?.name || '',
    postcode: order.postcode || order.shippingAddress?.postalCode || '',
    city: order.city || order.shippingAddress?.city || '',
    gross,
    feeAmount,
    netAfterFee,
    shipping,
    flowerValue,
    platformCommission,
    partnerPayout,
    currency: order.currencyCode || 'DKK'
  };
}

function aggregatePartnerWeek(rows) {
  const days = [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    weekday: day,
    label: ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'][day],
    deliveries: 0,
    gross: 0,
    feeAmount: 0,
    netAfterFee: 0,
    shipping: 0,
    flowerValue: 0,
    platformCommission: 0,
    partnerPayout: 0
  }));
  const dayMap = Object.fromEntries(days.map((d) => [String(d.weekday), d]));

  const totals = {
    deliveries: rows.length,
    gross: 0,
    feeAmount: 0,
    netAfterFee: 0,
    shipping: 0,
    flowerValue: 0,
    platformCommission: 0,
    partnerPayout: 0
  };

  rows.forEach((row) => {
    const dayBucket = dayMap[String(row.weekday)];
    if (dayBucket) {
      dayBucket.deliveries += 1;
      dayBucket.gross += row.gross;
      dayBucket.feeAmount += row.feeAmount;
      dayBucket.netAfterFee += row.netAfterFee;
      dayBucket.shipping += row.shipping;
      dayBucket.flowerValue += row.flowerValue;
      dayBucket.platformCommission += row.platformCommission;
      dayBucket.partnerPayout += row.partnerPayout;
    }
    totals.gross += row.gross;
    totals.feeAmount += row.feeAmount;
    totals.netAfterFee += row.netAfterFee;
    totals.shipping += row.shipping;
    totals.flowerValue += row.flowerValue;
    totals.platformCommission += row.platformCommission;
    totals.partnerPayout += row.partnerPayout;
  });

  return { totals, days };
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

// GET /api/reports/partner-weekly - weekly finance report for partner
router.get('/partner-weekly', requireRole('partner'), async (req, res) => {
  const weekStartInput = req.query.weekStart ? new Date(String(req.query.weekStart)) : new Date();
  const weekStart = startOfWeekMonday(weekStartInput);
  const weekEnd = endOfWeekSunday(weekStart);

  const feeRate = toNumber(req.query.feePercent, 2.39) / 100; // estimated payment fee rate
  const feeFixed = toNumber(req.query.feeFixed, 0);
  const platformCutRate = toNumber(req.query.platformPercent, 20) / 100;
  const options = { feeRate, feeFixed, platformCutRate };

  const orders = await Order.find({
    partner: req.user.id,
    status: { $ne: 'cancelled' },
    deliveryDate: { $gte: weekStart, $lte: weekEnd }
  })
    .sort({ deliveryDate: 1, createdAt: 1 })
    .limit(1000);

  const rows = orders.map((o) => buildPartnerFinanceRow(o, options));
  const summary = aggregatePartnerWeek(rows);

  res.json({
    week: { from: isoDateOnly(weekStart), to: isoDateOnly(weekEnd) },
    assumptions: {
      feePercent: toNumber(req.query.feePercent, 2.39),
      feeFixed: feeFixed,
      platformPercent: toNumber(req.query.platformPercent, 20)
    },
    summary,
    orders: rows
  });
});

// GET /api/reports/partner-weekly.csv - weekly CSV export for partner
router.get('/partner-weekly.csv', requireRole('partner'), async (req, res) => {
  const weekStartInput = req.query.weekStart ? new Date(String(req.query.weekStart)) : new Date();
  const weekStart = startOfWeekMonday(weekStartInput);
  const weekEnd = endOfWeekSunday(weekStart);

  const feeRate = toNumber(req.query.feePercent, 2.39) / 100;
  const feeFixed = toNumber(req.query.feeFixed, 0);
  const platformCutRate = toNumber(req.query.platformPercent, 20) / 100;
  const options = { feeRate, feeFixed, platformCutRate };

  const orders = await Order.find({
    partner: req.user.id,
    status: { $ne: 'cancelled' },
    deliveryDate: { $gte: weekStart, $lte: weekEnd }
  })
    .sort({ deliveryDate: 1, createdAt: 1 })
    .limit(5000);

  const rows = orders.map((o) => buildPartnerFinanceRow(o, options));
  const headers = [
    'OrderNumber',
    'DeliveryDate',
    'Status',
    'RecipientName',
    'Postcode',
    'City',
    'GrossDKK',
    'GatewayFeeDKK',
    'NetAfterFeeDKK',
    'ShippingDKK',
    'FlowersDKK',
    'Platform20pctDKK',
    'PartnerPayoutDKK'
  ];

  const csvRows = rows.map((r) => [
    r.orderNumber,
    r.deliveryDate,
    r.status,
    r.recipientName,
    r.postcode,
    r.city,
    r.gross.toFixed(2),
    r.feeAmount.toFixed(2),
    r.netAfterFee.toFixed(2),
    r.shipping.toFixed(2),
    r.flowerValue.toFixed(2),
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

module.exports = router;
