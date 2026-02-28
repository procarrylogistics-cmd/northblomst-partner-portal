/**
 * Extract add-on / tilvalg from Shopify order payload.
 * Supports: line_items (products), properties, note_attributes, order.note
 */

const ADDON_KEYWORDS = [
  'card', 'kort', 'felicitare',
  'chocolate', 'chokolade',
  'vase', 'vaza', 'vase',
  'teddy', 'bamse', 'ursulet', 'bjørn',
  'ribbon', 'bånd', 'panglica', 'band',
  'ekstra', 'extra', 'add-on', 'tilvalg', 'addon'
];

const ADDON_SKU_PREFIXES = ['ADDON_', 'EXTRA_', 'TILVALG_'];

const PROPERTY_KEY_MAP = {
  card: ['card', 'kort', 'felicitare', 'felicitación'],
  card_message: ['card text', 'korttekst', 'kort tekst', 'message', 'dedication', 'bemærkning', 'besked'],
  ribbon: ['ribbon', 'bånd', 'panglica', 'band', 'sløjfe'],
  ribbon_text: ['ribbon text', 'bånd tekst', 'ribbon tekst', 'sløjfetekst'],
  vase: ['vase', 'vaza', 'vase'],
  chocolate: ['chocolate', 'chokolade'],
  teddy: ['teddy', 'bamse', 'ursulet', 'bjørn', 'teddy bear'],
  other: []
};

function normalizeKey(s) {
  if (typeof s !== 'string') return '';
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/\s+/g, ' ');
}

function mapPropertyToKey(normalizedKey) {
  for (const [key, synonyms] of Object.entries(PROPERTY_KEY_MAP)) {
    if (synonyms.some((syn) => normalizedKey.includes(syn) || syn.includes(normalizedKey))) {
      return key;
    }
  }
  return 'other';
}

function isAddOnLineItem(lineItem) {
  const title = (lineItem.title || lineItem.name || '').toLowerCase();
  const sku = (lineItem.sku || '').toUpperCase();
  const variantTitle = (lineItem.variant_title || '').toLowerCase();

  if (ADDON_SKU_PREFIXES.some((p) => sku.startsWith(p))) return true;
  if (ADDON_KEYWORDS.some((kw) => title.includes(kw) || variantTitle.includes(kw))) return true;
  return false;
}

function dedupeAddOns(addOns) {
  const seen = new Set();
  return addOns.filter((a) => {
    const k = `${a.source}|${a.key}|${a.label}|${a.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * PAS 1: Summarize order for debug (no sensitive data)
 */
function summarizeOrderForDebug(order) {
  const lineItems = (order.line_items || []).map((li) => ({
    title: li.title,
    variant_title: li.variant_title,
    sku: li.sku,
    product_id: li.product_id,
    variant_id: li.variant_id,
    price: li.price,
    quantity: li.quantity,
    properties_keys: (li.properties || []).map((p) => p.name || p)
  }));
  const noteAttrKeys = (order.note_attributes || []).map((na) => na.name || na);
  return {
    line_items_count: lineItems.length,
    line_items: lineItems,
    note_attributes_keys: noteAttrKeys,
    order_note_length: order.note ? String(order.note).length : 0
  };
}

/**
 * PAS 2: Extract add-ons from Shopify order
 */
function extractAddOnsFromShopifyOrder(order) {
  const addOns = [];
  const raw = {
    lineItemCandidates: 0,
    propertyCandidates: 0,
    noteAttrCandidates: 0,
    noteParsed: false
  };

  const currency = order.currency || order.presentment_currency || 'DKK';

  // 2.1 line_items
  (order.line_items || []).forEach((li) => {
    if (!isAddOnLineItem(li)) return;
    raw.lineItemCandidates++;
    const priceObj = li.price_set?.shop_money || li.price;
    const price = typeof priceObj === 'object' ? priceObj?.amount : priceObj;
    addOns.push({
      source: 'line_item',
      key: mapPropertyToKey(normalizeKey(li.title || li.name || '')),
      label: li.title || li.name || 'Add-on',
      value: (li.variant_title && String(li.variant_title).trim()) || 'Ja',
      quantity: li.quantity || 1,
      price: price != null ? String(price) : undefined,
      currency,
      lineItemTitle: li.title || li.name,
      sku: li.sku,
      rawKey: li.title || li.name
    });
  });

  // 2.2 line_items[].properties
  (order.line_items || []).forEach((li) => {
    (li.properties || []).forEach((prop) => {
      const name = (prop.name || prop).toString().trim();
      const value = (prop.value || prop).toString().trim();
      if (!name || !value) return;
      const norm = normalizeKey(name);
      const key = mapPropertyToKey(norm);
      if (key === 'other' && !ADDON_KEYWORDS.some((kw) => norm.includes(kw))) return;
      raw.propertyCandidates++;
      addOns.push({
        source: 'property',
        key,
        label: name,
        value,
        quantity: 1,
        price: undefined,
        currency,
        lineItemTitle: li.title || li.name,
        sku: li.sku,
        rawKey: name
      });
    });
  });

  // 2.3 note_attributes
  (order.note_attributes || []).forEach((na) => {
    const name = (na.name || na).toString().trim();
    const value = (na.value || na).toString().trim();
    if (!name || !value) return;
    const norm = normalizeKey(name);
    const key = mapPropertyToKey(norm);
    if (key === 'other' && !ADDON_KEYWORDS.some((kw) => norm.includes(kw))) return;
    raw.noteAttrCandidates++;
    addOns.push({
      source: 'note_attribute',
      key,
      label: name,
      value,
      quantity: 1,
      price: undefined,
      currency,
      lineItemTitle: undefined,
      sku: undefined,
      rawKey: name
    });
  });

  // 2.4 order.note fallback (Key: Value lines)
  const note = order.note && String(order.note).trim();
  if (note) {
    const lines = note.split(/\r?\n/);
    lines.forEach((line) => {
      const m = line.match(/^([^:]+):\s*(.+)$/);
      if (!m) return;
      const [, k, v] = m;
      const name = (k || '').trim();
      const value = (v || '').trim();
      if (!name || !value) return;
      const norm = normalizeKey(name);
      const key = mapPropertyToKey(norm);
      if (key === 'other' && !ADDON_KEYWORDS.some((kw) => norm.includes(kw))) return;
      raw.noteParsed = true;
      addOns.push({
        source: 'note',
        key,
        label: name,
        value,
        quantity: 1,
        price: undefined,
        currency,
        lineItemTitle: undefined,
        sku: undefined,
        rawKey: name
      });
    });
  }

  const deduped = dedupeAddOns(addOns);

  const addOnsSummary = deduped
    .map((a) => {
      let s = `${a.label}: ${a.value}`;
      if (a.quantity > 1) s = `${a.quantity}× ${s}`;
      if (a.price) s += ` (${a.price} ${a.currency})`;
      return s;
    })
    .join(' | ');

  return {
    addOns: deduped,
    addOnsSummary: addOnsSummary || undefined,
    raw
  };
}

module.exports = {
  summarizeOrderForDebug,
  extractAddOnsFromShopifyOrder
};
