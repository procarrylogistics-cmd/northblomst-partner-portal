const FIXED_SHIPPING_DKK = 69;
const DEFAULT_FEE_PERCENT = 2.9;
const DEFAULT_FEE_FIXED = 1.8;
const DEFAULT_PLATFORM_PERCENT = 20;
/** Danish standard VAT — all displayed finance amounts are inclusive of MOMS. */
const MOMS_RATE = 0.25;

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Split an inkl. MOMS amount into excl. / MOMS / inkl. */
export function splitInclusiveMoms(inclusiveAmount, rate = MOMS_RATE) {
  const inclusive = round2(Math.max(0, toNumber(inclusiveAmount, 0)));
  const exclusive = round2(inclusive / (1 + rate));
  const moms = round2(inclusive - exclusive);
  return {
    exclusive,
    moms,
    inclusive,
    momsRate: rate,
    momsPercent: round2(rate * 100)
  };
}

function partnerHandlesDelivery(order, options = {}) {
  if (options.handlesDelivery != null) return !!options.handlesDelivery;
  if (options.includeShipping != null) return !!options.includeShipping;
  const partner = order?.partner;
  if (partner && typeof partner === 'object' && partner.handlesDelivery != null) {
    return partner.handlesDelivery !== false;
  }
  return true;
}

export function calculateOrderFinance(order, options = {}) {
  const feeRate = toNumber(options.feePercent, DEFAULT_FEE_PERCENT) / 100;
  const feeFixed = toNumber(options.feeFixed, DEFAULT_FEE_FIXED);
  const platformCutRate = toNumber(options.platformPercent, DEFAULT_PLATFORM_PERCENT) / 100;
  const deliveryComponent = FIXED_SHIPPING_DKK;
  const handlesDelivery = partnerHandlesDelivery(order, options);
  const shippingToPartner = handlesDelivery ? deliveryComponent : 0;

  const gross = toNumber(order?.totalPaidAmount ?? order?.totalPrice, 0);
  if (gross <= 0) return null;

  const feeAmount = round2(Math.max(0, gross * feeRate + feeFixed));
  const netAfterFee = round2(Math.max(0, gross - feeAmount));
  const flowerValue = round2(Math.max(0, netAfterFee - deliveryComponent));
  const platformCommission = round2(Math.max(0, flowerValue * platformCutRate));
  const partnerFlowerShare = round2(Math.max(0, flowerValue - platformCommission));
  const partnerPayout = round2(partnerFlowerShare + shippingToPartner);
  const partnerMoms = splitInclusiveMoms(partnerPayout);

  return {
    gross,
    feeAmount,
    netAfterFee,
    shipping: shippingToPartner,
    deliveryComponent,
    handlesDelivery,
    flowerValue,
    platformCommission,
    partnerFlowerShare,
    partnerPayout,
    partnerPayoutExMoms: partnerMoms.exclusive,
    partnerPayoutMoms: partnerMoms.moms,
    partnerPayoutInclMoms: partnerMoms.inclusive,
    momsPercent: partnerMoms.momsPercent,
    platformPercent: toNumber(options.platformPercent, DEFAULT_PLATFORM_PERCENT),
    currency: order.currencyCode || 'DKK'
  };
}

export function formatMoney(value, currency = 'DKK') {
  return `${Number(value || 0).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export {
  FIXED_SHIPPING_DKK,
  DEFAULT_PLATFORM_PERCENT,
  DEFAULT_FEE_PERCENT,
  DEFAULT_FEE_FIXED,
  MOMS_RATE
};
