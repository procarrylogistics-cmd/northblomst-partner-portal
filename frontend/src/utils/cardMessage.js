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

const SENDER_LABEL_PATTERNS = ['sender name', 'sender', 'afsender', 'fra', 'sendt af'];

export const CARD_MESSAGE_CHAR_LIMIT = 300;

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function isCardMessageAddon(addon) {
  if (!addon?.value?.trim()) return false;
  if (addon.key === 'card_message') return true;
  const norm = normalizeKey(addon.label);
  return CARD_LABEL_PATTERNS.some((pattern) => norm.includes(pattern) || pattern.includes(norm));
}

/** Card message from tilvalg/add-ons first, then stored cardText fields. */
export function extractCardMessage(order) {
  if (!order) return '';

  for (const addon of order.addOns || []) {
    if (isCardMessageAddon(addon)) return addon.value.trim();
  }

  if (order.cardText?.trim()) return order.cardText.trim();
  if (order.customer?.message?.trim()) return order.customer.message.trim();

  return '';
}

/** Name of the customer who placed the order (sender), not the recipient. */
export function extractSenderName(order) {
  if (!order) return '';

  for (const addon of order.addOns || []) {
    if (!addon?.value?.trim()) continue;
    const norm = normalizeKey(addon.label);
    if (SENDER_LABEL_PATTERNS.some((pattern) => norm.includes(pattern) || pattern.includes(norm))) {
      return addon.value.trim();
    }
  }

  if (order.customer?.name?.trim()) return order.customer.name.trim();

  return '';
}

export function truncateCardMessage(message, limit = CARD_MESSAGE_CHAR_LIMIT) {
  const text = String(message || '').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}…`;
}
