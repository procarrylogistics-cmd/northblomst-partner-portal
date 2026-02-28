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

function parseOrderNumber(o) {
  const name = o.shopifyOrderName || o.orderNumber || o.shopifyOrderNumber || '';
  const m = String(name).match(/#?(\d+)/);
  if (m) return parseInt(m[1], 10);
  return null;
}
