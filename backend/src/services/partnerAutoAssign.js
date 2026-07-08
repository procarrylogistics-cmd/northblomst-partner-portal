const User = require('../models/User');

function toPostalNumber(postalCodeRaw) {
  const numeric = parseInt(String(postalCodeRaw || '').trim(), 10);
  return Number.isNaN(numeric) ? null : numeric;
}

function parseRangeToken(token) {
  const value = String(token || '').trim();
  if (!value) return null;
  if (!value.includes('-')) {
    const exact = parseInt(value, 10);
    if (Number.isNaN(exact)) return null;
    return { exact };
  }
  const [startRaw, endRaw] = value.split('-').map((x) => x.trim());
  const start = parseInt(startRaw, 10);
  const end = parseInt(endRaw, 10);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function partnerMatchesPostal(partner, postalNumber) {
  if (!partner || !Array.isArray(partner.zoneRanges) || !partner.zoneRanges.length || postalNumber == null) return false;
  return partner.zoneRanges.some((raw) => {
    const range = parseRangeToken(raw);
    if (!range) return false;
    if (range.exact != null) return range.exact === postalNumber;
    return postalNumber >= range.start && postalNumber <= range.end;
  });
}

function fallbackScore(partner) {
  const name = String(partner?.name || '').trim().toLowerCase();
  const email = String(partner?.email || '').trim().toLowerCase();
  const hasZones = Array.isArray(partner?.zoneRanges) && partner.zoneRanges.length > 0;
  if (name === 'main') return 1;
  if (email.startsWith('main@')) return 2;
  if (!hasZones) return 3;
  return 99;
}

function pickFallbackPartner(partners) {
  if (!Array.isArray(partners) || !partners.length) return null;
  const sorted = [...partners].sort((a, b) => {
    const scoreDiff = fallbackScore(a) - fallbackScore(b);
    if (scoreDiff !== 0) return scoreDiff;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  return fallbackScore(sorted[0]) <= 3 ? sorted[0] : null;
}

function selectPartnerForPostal(partners, postalCode) {
  const postalNumber = toPostalNumber(postalCode);
  const zoneMatch = (partners || []).find((p) => partnerMatchesPostal(p, postalNumber));
  if (zoneMatch) return zoneMatch;
  return pickFallbackPartner(partners);
}

function extractCurrentPartnerId(order) {
  const value = order?.partner;
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function isFallbackPartner(partner) {
  return fallbackScore(partner) <= 3;
}

async function autoAssignPartnerForOrder(order, options = {}) {
  if (!order) return { changed: false, partner: null };
  const keepAssignedNonFallback = options.keepAssignedNonFallback !== false;
  const postalCode = order.shippingAddress?.postalCode || order.postcode || '';
  const partners = await User.find({ role: 'partner' }).select('_id name email zoneRanges');
  const picked = selectPartnerForPostal(partners, postalCode);
  if (!picked) return { changed: false, partner: null };

  const currentPartnerId = extractCurrentPartnerId(order);
  if (currentPartnerId) {
    if (currentPartnerId === String(picked._id)) return { changed: false, partner: picked };
    if (keepAssignedNonFallback) {
      const current = partners.find((p) => String(p._id) === currentPartnerId);
      if (current && !isFallbackPartner(current)) {
        return { changed: false, partner: current };
      }
    }
  }

  order.partner = picked._id;
  if (!order.assignedAt) order.assignedAt = new Date();
  await order.save();
  return { changed: true, partner: picked };
}

async function rebalanceOpenOrdersByPostal() {
  const orders = await require('../models/Order')
    .find({ status: { $ne: 'cancelled' } })
    .select('_id partner shippingAddress postcode assignedAt status');

  let changed = 0;
  for (const order of orders) {
    const result = await autoAssignPartnerForOrder(order, { keepAssignedNonFallback: true });
    if (result.changed) changed += 1;
  }
  return { checked: orders.length, changed };
}

module.exports = {
  autoAssignPartnerForOrder,
  rebalanceOpenOrdersByPostal,
  selectPartnerForPostal
};

