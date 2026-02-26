/**
 * Build createdAt query from receivedPreset and receivedFrom/receivedTo params.
 * @param {string} receivedPreset - today|last24h|week
 * @param {string} receivedFrom - YYYY-MM-DD
 * @param {string} receivedTo - YYYY-MM-DD
 * @returns {object|null} MongoDB query for createdAt, or null
 */
function buildReceivedQuery(receivedPreset, receivedFrom, receivedTo) {
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
  function addHours(d, n) {
    return new Date(d.getTime() + n * 60 * 60 * 1000);
  }
  function startOfWeek(d) {
    const x = new Date(d);
    const day = x.getDay();
    const diff = x.getDate() - day + (day === 0 ? -6 : 1);
    x.setDate(diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function endOfWeek(d) {
    const x = startOfWeek(d);
    x.setDate(x.getDate() + 6);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  if (receivedFrom || receivedTo) {
    const q = {};
    if (receivedFrom) q.$gte = startOfDay(new Date(receivedFrom));
    if (receivedTo) q.$lte = endOfDay(new Date(receivedTo));
    return Object.keys(q).length ? { createdAt: q } : null;
  }

  switch (receivedPreset) {
    case 'today':
      return { createdAt: { $gte: startOfDay(now), $lte: endOfDay(now) } };
    case 'last24h':
      return { createdAt: { $gte: addHours(now, -24) } };
    case 'week':
      return {
        createdAt: {
          $gte: startOfWeek(now),
          $lte: endOfWeek(now)
        }
      };
    default:
      return null;
  }
}

module.exports = { buildReceivedQuery };
