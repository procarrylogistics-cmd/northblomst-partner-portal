/**
 * Sort orders newest first (for left list display).
 * Primary: createdAt descending
 * Fallback: Shopify order number (#1010) descending
 * Last: ObjectId timestamp descending
 */
export function sortOrdersNewestFirst(orders) {
  return [...orders].sort((a, b) => {
    const tsA = a.createdAt ? new Date(a.createdAt).getTime() : null;
    const tsB = b.createdAt ? new Date(b.createdAt).getTime() : null;
    if (tsA != null && tsB != null) return tsB - tsA;

    const numA = parseOrderNumber(a);
    const numB = parseOrderNumber(b);
    if (numA != null && numB != null) return numB - numA;

    // ObjectId string sorts chronologically; fallback to string compare
    return String(b._id || '').localeCompare(String(a._id || ''));
  });
}

/**
 * Sort orders by delivery date ascending (today, tomorrow, etc).
 * Fallback: received/created ascending, then order number.
 */
export function sortOrdersByDeliveryDate(orders) {
  return [...orders].sort((a, b) => {
    const dA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Number.MAX_SAFE_INTEGER;
    const dB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (dA !== dB) return dA - dB;

    const rA = new Date(a.receivedAt || a.createdAt || 0).getTime();
    const rB = new Date(b.receivedAt || b.createdAt || 0).getTime();
    if (rA !== rB) return rA - rB;

    const numA = parseOrderNumber(a);
    const numB = parseOrderNumber(b);
    if (numA != null && numB != null) return numA - numB;

    return String(a._id || '').localeCompare(String(b._id || ''));
  });
}

function parseOrderNumber(o) {
  const name = o.shopifyOrderName || o.orderNumber || o.shopifyOrderNumber || '';
  const m = String(name).match(/#?(\d+)/);
  if (m) return parseInt(m[1], 10);
  return null;
}
