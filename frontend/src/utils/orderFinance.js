const FIXED_SHIPPING_DKK = 69;
const DEFAULT_FEE_PERCENT = 2.39;
const DEFAULT_PLATFORM_PERCENT = 20;

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function calculateOrderFinance(order, options = {}) {
  const feeRate = toNumber(options.feePercent, DEFAULT_FEE_PERCENT) / 100;
  const feeFixed = toNumber(options.feeFixed, 0);
  const platformCutRate = toNumber(options.platformPercent, DEFAULT_PLATFORM_PERCENT) / 100;
  const shipping = FIXED_SHIPPING_DKK;

  const gross = toNumber(order?.totalPaidAmount ?? order?.totalPrice, 0);
  if (gross <= 0) return null;

  const feeAmount = round2(Math.max(0, gross * feeRate + feeFixed));
  const netAfterFee = round2(Math.max(0, gross - feeAmount));
  const flowerValue = round2(Math.max(0, netAfterFee - shipping));
  const platformCommission = round2(Math.max(0, flowerValue * platformCutRate));
  const partnerFlowerShare = round2(Math.max(0, flowerValue - platformCommission));
  const partnerPayout = round2(partnerFlowerShare + shipping);

  return {
    gross,
    feeAmount,
    netAfterFee,
    shipping,
    flowerValue,
    platformCommission,
    partnerFlowerShare,
    partnerPayout,
    platformPercent: toNumber(options.platformPercent, DEFAULT_PLATFORM_PERCENT),
    currency: order.currencyCode || 'DKK'
  };
}

export function formatMoney(value, currency = 'DKK') {
  return `${Number(value || 0).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export { FIXED_SHIPPING_DKK, DEFAULT_PLATFORM_PERCENT };
