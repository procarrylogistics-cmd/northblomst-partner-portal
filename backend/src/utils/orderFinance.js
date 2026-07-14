function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const FIXED_SHIPPING_DKK = toNumber(process.env.FIXED_SHIPPING_DKK, 69);
const DEFAULT_FEE_PERCENT = toNumber(process.env.STRIPE_FEE_PERCENT, 2.39);
const DEFAULT_PLATFORM_PERCENT = toNumber(process.env.PLATFORM_CUT_PERCENT, 20);

function round2(n) {
  return Math.round(n * 100) / 100;
}

function getFinanceOptions(query = {}) {
  return {
    feeRate: toNumber(query.feePercent, DEFAULT_FEE_PERCENT) / 100,
    feeFixed: toNumber(query.feeFixed, 0),
    platformCutRate: toNumber(query.platformPercent, DEFAULT_PLATFORM_PERCENT) / 100,
    fixedShipping: FIXED_SHIPPING_DKK
  };
}

function orderDisplayNumber(order) {
  return order.orderNumber || order.shopifyOrderName || order.shopifyOrderNumber || String(order._id);
}

/** Full finance row (admin). Stripe fee deducted first, then fixed 69 DKK shipping. */
function buildOrderFinanceRow(order, options = getFinanceOptions()) {
  const gross = toNumber(order.totalPaidAmount ?? order.totalPrice, 0);
  const shipping = options.fixedShipping;
  const feeAmount = round2(Math.max(0, gross * options.feeRate + options.feeFixed));
  const netAfterFee = round2(Math.max(0, gross - feeAmount));
  const flowerValue = round2(Math.max(0, netAfterFee - shipping));
  const platformCommission = round2(Math.max(0, flowerValue * options.platformCutRate));
  const partnerFlowerShare = round2(Math.max(0, flowerValue - platformCommission));
  const partnerPayout = round2(partnerFlowerShare + shipping);
  const deliveryDate = order.deliveryDate || order.createdAt;

  return {
    orderId: String(order._id),
    orderNumber: orderDisplayNumber(order),
    deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString().slice(0, 10) : '',
    deliveryDateRaw: deliveryDate,
    weekday: deliveryDate ? new Date(deliveryDate).getDay() : null,
    status: order.status || '',
    recipientName: order.recipientName || order.customer?.name || '',
    postcode: order.postcode || order.shippingAddress?.postalCode || '',
    city: order.city || order.shippingAddress?.city || '',
    partnerName: order.partner?.name || '',
    gross,
    feeAmount,
    netAfterFee,
    shipping,
    flowerValue,
    platformCommission,
    partnerFlowerShare,
    partnerPayout,
    currency: order.currencyCode || 'DKK'
  };
}

/** Partner-safe view: no gross or Stripe fee. */
function toPartnerFinanceView(row) {
  return {
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    deliveryDate: row.deliveryDate,
    weekday: row.weekday,
    status: row.status,
    recipientName: row.recipientName,
    postcode: row.postcode,
    city: row.city,
    flowerValue: row.flowerValue,
    shipping: row.shipping,
    platformCommission: row.platformCommission,
    partnerPayout: row.partnerPayout,
    currency: row.currency
  };
}

function aggregateFinanceWeek(rows, partnerView = false) {
  const dayKeys = [1, 2, 3, 4, 5, 6, 0];
  const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const days = dayKeys.map((day) => ({
    weekday: day,
    label: dayLabels[day],
    deliveries: 0,
    gross: 0,
    feeAmount: 0,
    netAfterFee: 0,
    shipping: 0,
    flowerValue: 0,
    platformCommission: 0,
    partnerFlowerShare: 0,
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
    partnerFlowerShare: 0,
    partnerPayout: 0
  };

  const addTo = (bucket, row) => {
    bucket.deliveries += 1;
    if (!partnerView) {
      bucket.gross += row.gross;
      bucket.feeAmount += row.feeAmount;
      bucket.netAfterFee += row.netAfterFee;
    }
    bucket.shipping += row.shipping;
    bucket.flowerValue += row.flowerValue;
    bucket.platformCommission += row.platformCommission;
    bucket.partnerFlowerShare += row.partnerFlowerShare;
    bucket.partnerPayout += row.partnerPayout;
  };

  rows.forEach((row) => {
    const dayBucket = dayMap[String(row.weekday)];
    if (dayBucket) addTo(dayBucket, row);
    addTo(totals, row);
  });

  Object.values(dayMap).forEach((d) => {
    if (partnerView) {
      delete d.gross;
      delete d.feeAmount;
      delete d.netAfterFee;
    }
    d.shipping = round2(d.shipping);
    d.flowerValue = round2(d.flowerValue);
    d.platformCommission = round2(d.platformCommission);
    d.partnerFlowerShare = round2(d.partnerFlowerShare);
    d.partnerPayout = round2(d.partnerPayout);
    if (!partnerView) {
      d.gross = round2(d.gross);
      d.feeAmount = round2(d.feeAmount);
      d.netAfterFee = round2(d.netAfterFee);
    }
  });

  if (partnerView) {
    delete totals.gross;
    delete totals.feeAmount;
    delete totals.netAfterFee;
  } else {
    totals.gross = round2(totals.gross);
    totals.feeAmount = round2(totals.feeAmount);
    totals.netAfterFee = round2(totals.netAfterFee);
  }
  totals.shipping = round2(totals.shipping);
  totals.flowerValue = round2(totals.flowerValue);
  totals.platformCommission = round2(totals.platformCommission);
  totals.partnerFlowerShare = round2(totals.partnerFlowerShare);
  totals.partnerPayout = round2(totals.partnerPayout);

  return { totals, days: dayKeys.map((d) => dayMap[String(d)]) };
}

module.exports = {
  FIXED_SHIPPING_DKK,
  DEFAULT_FEE_PERCENT,
  DEFAULT_PLATFORM_PERCENT,
  getFinanceOptions,
  buildOrderFinanceRow,
  toPartnerFinanceView,
  aggregateFinanceWeek,
  orderDisplayNumber
};
