/**
 * Detect delivery service style from Shopify tags / shipping title.
 * express → orange, pickup → green, else standard (blue).
 */

function normalizeHay(parts) {
  return parts
    .filter(Boolean)
    .map((p) => String(p).toLowerCase())
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function resolveDeliveryServiceType(order = {}, shopifyOrder = null) {
  const shippingTitles = (shopifyOrder?.shipping_lines || [])
    .map((l) => l.title || l.code || '')
    .join(' ');
  const hay = normalizeHay([
    order.tags,
    order.shippingMethodTitle,
    order.deliveryServiceType,
    shippingTitles,
    shopifyOrder?.tags
  ]);

  if (/pick\s*up|pickup|afhent|hent selv|click.?and.?collect/.test(hay)) {
    return 'pickup';
  }
  if (/express|same.?day|sameday|samme.?dag|asap|hurtig|expresslevering/.test(hay)) {
    return 'express';
  }
  return 'standard';
}

module.exports = { resolveDeliveryServiceType };
