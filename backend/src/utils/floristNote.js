const FLORIST_NOTE_PATTERNS = [
  'notes to florist',
  'note to florist',
  'notes for florist',
  'note for florist',
  'florist note',
  'florist notes',
  'note til florist',
  'noter til florist',
  'bemaerkning til florist',
  'bemærkning til florist',
  'florist bemaerkning',
  'florist bemærkning'
];

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function isFloristNoteAddon(addon) {
  if (!addon?.value || !String(addon.value).trim()) return false;
  const norm = normalizeKey(addon.label || addon.key);
  if (!norm) return false;
  return FLORIST_NOTE_PATTERNS.some((pattern) => {
    const p = normalizeKey(pattern);
    return norm.includes(p) || p.includes(norm);
  });
}

/**
 * Prefer admin-saved order.notes, then Shopify "Notes to florist" add-on.
 */
function extractFloristNote(order) {
  if (!order) return '';
  if (typeof order.notes === 'string' && order.notes.trim()) {
    return order.notes.trim();
  }
  for (const addon of order.addOns || []) {
    if (isFloristNoteAddon(addon)) return String(addon.value).trim();
  }
  return '';
}

module.exports = { extractFloristNote, isFloristNoteAddon, FLORIST_NOTE_PATTERNS };
