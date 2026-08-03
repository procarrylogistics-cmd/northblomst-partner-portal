function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

const DELIVERY_ADDRESS_PATTERNS = [
  'delivery address',
  'leveringsadresse',
  'shipping address',
  'adresse',
  'address'
];

function isDeliveryAddressAddon(addon) {
  if (!addon) return false;
  const key = normalizeKey(addon.key || '');
  if (key === 'delivery_address' || key === 'address') return true;
  const norm = normalizeKey(addon.label || addon.rawKey || '');
  // Prefer explicit delivery address labels; avoid matching "email address" etc.
  if (norm.includes('delivery address') || norm.includes('leveringsadresse') || norm.includes('shipping address')) {
    return true;
  }
  if (norm === 'address' || norm === 'adresse') return true;
  return DELIVERY_ADDRESS_PATTERNS.some((p) => norm === p);
}

function formatDeliveryAddress({ address, postcode, city }) {
  const street = String(address || '').trim();
  const zipCity = [String(postcode || '').trim(), String(city || '').trim()].filter(Boolean).join(' ');
  return [street, zipCity].filter(Boolean).join(', ');
}

/**
 * Sync Tilvalg "Delivery address" with the edited shipping address.
 * Keeps previousValue so UI can show struck-through old address.
 */
function syncDeliveryAddressOnOrder(order) {
  const nextValue = formatDeliveryAddress({
    address: order.address || order.shippingAddress?.address1,
    postcode: order.postcode || order.shippingAddress?.postalCode,
    city: order.city || order.shippingAddress?.city
  });
  if (!nextValue) return order;

  const addOns = Array.isArray(order.addOns) ? order.addOns.map((a) => (a?.toObject ? a.toObject() : { ...a })) : [];
  const indexes = [];
  addOns.forEach((addon, idx) => {
    if (isDeliveryAddressAddon(addon)) indexes.push(idx);
  });

  if (indexes.length) {
    const firstIdx = indexes[0];
    const oldValue = String(addOns[firstIdx].value || '').trim();
    const previousValue =
      oldValue && oldValue !== nextValue
        ? oldValue
        : addOns[firstIdx].previousValue || undefined;

    addOns[firstIdx] = {
      ...addOns[firstIdx],
      key: 'delivery_address',
      label: addOns[firstIdx].label || 'Delivery address',
      value: nextValue,
      previousValue: previousValue && previousValue !== nextValue ? previousValue : undefined
    };

    for (let i = indexes.length - 1; i >= 1; i -= 1) {
      addOns.splice(indexes[i], 1);
    }
  } else {
    addOns.push({
      source: 'manual',
      key: 'delivery_address',
      label: 'Delivery address',
      value: nextValue,
      quantity: 1
    });
  }

  order.addOns = addOns;
  return order;
}

module.exports = {
  isDeliveryAddressAddon,
  formatDeliveryAddress,
  syncDeliveryAddressOnOrder
};
