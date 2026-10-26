export function resolveDeliveryServiceType(order) {
  if (!order) return 'standard';
  const stored = String(order.deliveryServiceType || '').toLowerCase();
  if (stored === 'express' || stored === 'pickup' || stored === 'standard') return stored;

  const hay = [order.tags, order.shippingMethodTitle]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/pick\s*up|pickup|afhent|hent selv|click.?and.?collect/.test(hay)) return 'pickup';
  if (/express|same.?day|sameday|samme.?dag|asap|hurtig|expresslevering/.test(hay)) {
    return 'express';
  }
  return 'standard';
}

export function deliveryServiceLabel(type) {
  if (type === 'express') return 'Express';
  if (type === 'pickup') return 'Pickup';
  return 'Standard';
}
