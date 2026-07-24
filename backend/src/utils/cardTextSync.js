const CARD_LABEL_PATTERNS = [
  'card message',
  'card text',
  'korttekst',
  'kort tekst',
  'kortbesked',
  'kort besked',
  'besked',
  'message',
  'dedication',
  'bemærkning',
  'bemarkning',
  'overskrift'
];

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function isCardMessageAddon(addon) {
  if (!addon) return false;
  if (addon.key === 'card_message') return true;
  const norm = normalizeKey(addon.label || addon.rawKey || '');
  return CARD_LABEL_PATTERNS.some((pattern) => norm.includes(pattern) || pattern.includes(norm));
}

/**
 * Keep addOns / customer.message in sync when cardText is edited manually.
 * Empty cardText removes card-message add-ons so the UI can clear korttekst.
 */
function syncCardTextOnOrder(order, cardTextRaw) {
  const cardText = String(cardTextRaw || '').trim();
  order.cardText = cardText;
  order.cardFlag = !!cardText;

  const addOns = Array.isArray(order.addOns) ? [...order.addOns] : [];
  const cardAddonIndexes = [];
  addOns.forEach((addon, idx) => {
    if (isCardMessageAddon(addon)) cardAddonIndexes.push(idx);
  });

  if (cardText) {
    if (cardAddonIndexes.length) {
      const firstIdx = cardAddonIndexes[0];
      addOns[firstIdx] = {
        ...addOns[firstIdx],
        key: 'card_message',
        label: addOns[firstIdx].label || 'Card message',
        value: cardText
      };
      // remove duplicate card message addons
      for (let i = cardAddonIndexes.length - 1; i >= 1; i -= 1) {
        addOns.splice(cardAddonIndexes[i], 1);
      }
    } else {
      addOns.push({
        source: 'manual',
        key: 'card_message',
        label: 'Card message',
        value: cardText,
        quantity: 1
      });
    }
  } else {
    for (let i = cardAddonIndexes.length - 1; i >= 0; i -= 1) {
      addOns.splice(cardAddonIndexes[i], 1);
    }
  }

  order.addOns = addOns;
  if (order.customer && typeof order.customer === 'object') {
    order.customer = {
      ...(order.customer.toObject ? order.customer.toObject() : order.customer),
      message: cardText
    };
  } else if (cardText) {
    order.customer = { ...(order.customer || {}), message: cardText };
  }

  return order;
}

module.exports = {
  isCardMessageAddon,
  syncCardTextOnOrder
};
