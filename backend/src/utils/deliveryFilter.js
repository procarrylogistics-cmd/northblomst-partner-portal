/**
 * Build deliveryDate query from deliveryPreset and deliveryDate params.
 * @param {string} deliveryPreset - today|tomorrow|date
 * @param {string} deliveryDate - YYYY-MM-DD (used when preset=date)
 * @param {string} from - YYYY-MM-DD (legacy)
 * @param {string} to - YYYY-MM-DD (legacy)
 * @returns {object|null} MongoDB query for deliveryDate, or null if no filter
 */
function buildDeliveryDateQuery(deliveryPreset, deliveryDate, from, to) {
  const now = new Date();

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function endOfDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }
  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  // Prefer explicit deliveryDate (ISO YYYY-MM-DD) when provided
  if (deliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
    const d = new Date(deliveryDate + 'T00:00:00');
    return { deliveryDate: { $gte: startOfDay(d), $lte: endOfDay(d) } };
  }

  if (from || to) {
    const q = {};
    if (from) q.$gte = startOfDay(new Date(from));
    if (to) q.$lte = endOfDay(new Date(to));
    return Object.keys(q).length ? { deliveryDate: q } : null;
  }

  switch (deliveryPreset) {
    case 'today':
      return { deliveryDate: { $gte: startOfDay(now), $lte: endOfDay(now) } };
    case 'tomorrow': {
      const t = addDays(now, 1);
      return { deliveryDate: { $gte: startOfDay(t), $lte: endOfDay(t) } };
    }
    default:
      return null;
  }
}

module.exports = { buildDeliveryDateQuery };
