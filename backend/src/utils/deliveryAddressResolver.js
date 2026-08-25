const { isDeliveryAddressAddon } = require('./addressSync');

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function parseDeliveryAddressString(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const zipCity = parts[parts.length - 1];
    const m = zipCity.match(/^(\d{4})\s+(.+)$/);
    if (m) {
      return {
        address1: parts.slice(0, -1).join(', '),
        address2: '',
        postalCode: m[1],
        city: m[2]
      };
    }
  }

  const inline = text.match(/^(.+?)[,\s]+(\d{4})\s+(.+)$/);
  if (inline) {
    return {
      address1: inline[1].trim(),
      address2: '',
      postalCode: inline[2],
      city: inline[3].trim()
    };
  }

  return { address1: text, address2: '', postalCode: '', city: '' };
}

function findAddonValue(addOns, patterns) {
  for (const addon of addOns || []) {
    const label = normalizeKey(addon.label || addon.key || addon.rawKey || '');
    if (!label) continue;
    if (patterns.some((p) => label.includes(p) || p.includes(label))) {
      const value = String(addon.value || '').trim();
      if (value) return value;
    }
  }
  return '';
}

function extractFromAddOns(addOns) {
  const deliveryAddon = (addOns || []).find(
    (a) => isDeliveryAddressAddon(a) && String(a.value || '').trim()
  );
  const parsed = deliveryAddon ? parseDeliveryAddressString(deliveryAddon.value) : null;

  const street =
    findAddonValue(addOns, [
      'street address',
      'street',
      'gade',
      'vej',
      'adresse',
      'address line'
    ]) || parsed?.address1 || '';

  const postalCode =
    findAddonValue(addOns, ['postal code', 'postnummer', 'postnr', 'zip', 'post code']) ||
    parsed?.postalCode ||
    '';

  const city =
    findAddonValue(addOns, ['city', 'by', 'town']) || parsed?.city || '';

  const recipientName = findAddonValue(addOns, [
    'recipient name',
    'modtagernavn',
    'modtager navn',
    'modtager',
    'leveres til'
  ]);

  const phone = findAddonValue(addOns, ['phone', 'telefon', 'mobil', 'recipient phone']);

  if (!street && !postalCode && !city && !recipientName) return null;

  return {
    address1: street || parsed?.address1 || '',
    address2: parsed?.address2 || '',
    postalCode,
    city,
    recipientName,
    phone
  };
}

function fromShopifyShipping(shopifyOrder) {
  const ship = shopifyOrder?.shipping_address || {};
  return {
    address1: String(ship.address1 || '').trim(),
    address2: String(ship.address2 || '').trim(),
    postalCode: String(ship.zip || ship.postal_code || '').trim(),
    city: String(ship.city || '').trim(),
    country: String(ship.country || '').trim(),
    recipientName: String(
      ship.name ||
        `${ship.first_name || ''} ${ship.last_name || ''}`.trim() ||
        ''
    ).trim(),
    phone: String(ship.phone || '').trim()
  };
}

function fromPortalFields(order) {
  const ms = order.shippingAddress || {};
  return {
    address1: String(order.address || ms.address1 || '').trim(),
    address2: String(ms.address2 || '').trim(),
    postalCode: String(order.postcode || ms.postalCode || '').trim(),
    city: String(order.city || ms.city || '').trim(),
    country: String(ms.country || '').trim(),
    recipientName: String(order.recipientName || order.customer?.name || '').trim(),
    phone: String(order.phone || order.customer?.phone || '').trim()
  };
}

function isDanishPostalCode(postalCode) {
  return /^\d{4}$/.test(String(postalCode || '').trim());
}

function hasCompleteAddress(fields) {
  return !!(fields.address1 && fields.postalCode && fields.city);
}

/**
 * Resolve Northblomst delivery address (Leveringsadresse), not billing/shipping snapshot.
 * Priority: Tilvalg delivery address → portal fields → Shopify shipping (DK only if addon exists).
 */
function resolveDeliveryAddress(order, shopifyOrder) {
  const addOns = order?.addOns || [];
  const fromAddons = extractFromAddOns(addOns);
  const portal = fromPortalFields(order);
  const shipping =
    fromShopifyShipping(shopifyOrder) ||
    fromShopifyShipping({ shipping_address: order?.raw?.shipping_address });

  // Explicit delivery address from checkout add-ons always wins
  if (fromAddons && (fromAddons.address1 || fromAddons.postalCode || fromAddons.city)) {
    return {
      address1: fromAddons.address1 || portal.address1 || shipping.address1,
      address2: fromAddons.address2 || portal.address2 || shipping.address2,
      postalCode: fromAddons.postalCode || portal.postalCode || shipping.postalCode,
      city: fromAddons.city || portal.city || shipping.city,
      country: portal.country || shipping.country || 'DK',
      recipientName:
        fromAddons.recipientName ||
        portal.recipientName ||
        shipping.recipientName ||
        'Recipient',
      phone: fromAddons.phone || portal.phone || shipping.phone,
      source: 'addon'
    };
  }

  // Portal-edited Danish delivery
  if (hasCompleteAddress(portal) && isDanishPostalCode(portal.postalCode)) {
    return { ...portal, country: portal.country || 'DK', source: 'portal' };
  }

  // Shipping outside DK while portal has DK → prefer portal partials
  const shipCountry = (shipping.country || '').toUpperCase();
  if (shipCountry && shipCountry !== 'DK' && isDanishPostalCode(portal.postalCode)) {
    return {
      address1: portal.address1 || shipping.address1,
      address2: portal.address2 || shipping.address2,
      postalCode: portal.postalCode,
      city: portal.city || shipping.city,
      country: 'DK',
      recipientName: portal.recipientName || shipping.recipientName || 'Recipient',
      phone: portal.phone || shipping.phone,
      source: 'portal_over_foreign_shipping'
    };
  }

  if (hasCompleteAddress(portal)) {
    return { ...portal, country: portal.country || shipping.country || 'DK', source: 'portal' };
  }

  if (hasCompleteAddress(shipping)) {
    return { ...shipping, source: 'shipping' };
  }

  return {
    address1: portal.address1 || shipping.address1,
    address2: portal.address2 || shipping.address2,
    postalCode: portal.postalCode || shipping.postalCode,
    city: portal.city || shipping.city,
    country: portal.country || shipping.country || 'DK',
    recipientName: portal.recipientName || shipping.recipientName || 'Recipient',
    phone: portal.phone || shipping.phone,
    source: 'partial'
  };
}

/** Apply resolved delivery onto order fields (webhook / sync). */
function applyDeliveryAddressToOrder(order, shopifyOrder) {
  const resolved = resolveDeliveryAddress(order, shopifyOrder);
  if (resolved.recipientName) order.recipientName = resolved.recipientName;
  if (resolved.phone) order.phone = resolved.phone;
  if (resolved.address1) order.address = resolved.address1;
  if (resolved.postalCode) order.postcode = resolved.postalCode;
  if (resolved.city) order.city = resolved.city;
  order.shippingAddress = {
    ...(order.shippingAddress?.toObject
      ? order.shippingAddress.toObject()
      : order.shippingAddress || {}),
    address1: resolved.address1 || order.shippingAddress?.address1,
    address2: resolved.address2 || order.shippingAddress?.address2,
    postalCode: resolved.postalCode || order.shippingAddress?.postalCode,
    city: resolved.city || order.shippingAddress?.city,
    country: resolved.country || order.shippingAddress?.country || 'DK'
  };
  return order;
}

module.exports = {
  resolveDeliveryAddress,
  applyDeliveryAddressToOrder,
  parseDeliveryAddressString,
  extractFromAddOns
};
