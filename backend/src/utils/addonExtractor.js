/**
 * Extract add-on / tilvalg from Shopify order payload.
 * Supports: line_items (products), properties, note_attributes, order.note
 */

const ADDON_KEYWORDS = [
  'card', 'kort', 'felicitare', 'gavekort',
  'chocolate', 'chokolade',
  'vase', 'vaza',
  'teddy', 'bamse', 'ursulet', 'bjørn',
  'ribbon', 'bånd', 'panglica', 'band', 'slojfe', 'sløjfe',
  'ekstra', 'extra', 'add-on', 'tilvalg', 'addon', 'tillæg', 'tillaeg',
  'personaliseret', 'personalized', 'overskrift', 'tekst', 'text',
  'ciocolata', 'ursulet'
];

const ADDON_SKU_PREFIXES = ['ADDON_', 'EXTRA_', 'TILVALG_', 'TILLÆG_', 'TILVALG'];

const PROPERTY_KEY_MAP = {
  card: ['card', 'kort', 'felicitare', 'gavekort'],
  card_message: ['card text', 'korttekst', 'kort tekst', 'message', 'dedication', 'bemærkning', 'besked', 'kortbesked', 'overskrift'],
  ribbon: ['ribbon', 'bånd', 'panglica', 'band', 'sløjfe', 'slojfe'],
  ribbon_text: ['ribbon text', 'bånd tekst', 'båndtekst', 'ribbon tekst', 'sløjfetekst', 'bandtekst'],
  vase: ['vase', 'vaza'],
  chocolate: ['chocolate', 'chokolade'],
  teddy: ['teddy', 'bamse', 'ursulet', 'bjørn'],
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

  // 2.2 line_items[].properties – INCLUSIVE: include ALL non-empty properties
  (order.line_items || []).forEach((li) => {
    const rawProps = li.properties || [];
    const propList = Array.isArray(rawProps)
      ? rawProps
      : typeof rawProps === 'object' && rawProps !== null
        ? Object.entries(rawProps).map(([k, v]) => ({ name: k, value: v }))
        : [];
    propList.forEach((prop) => {
      const name = (prop && (prop.name ?? prop)).toString().trim().replace(/^_+/, '');
      const value = (prop && (prop.value ?? '')).toString().trim();
      if (!name || !value) return;
      const norm = normalizeKey(name);
      if (norm.length < 2) return;
      raw.propertyCandidates++;
      addOns.push({
        source: 'property',
        key: mapPropertyToKey(norm),
        label: name.replace(/^_+/, ''),
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

  // 2.3 note_attributes – INCLUSIVE: include ALL
  (order.note_attributes || []).forEach((na) => {
    const name = (na.name != null ? na.name : na).toString().trim().replace(/^_+/, '');
    const value = (na.value != null ? na.value : '').toString().trim();
    if (!name || !value) return;
    const norm = normalizeKey(name);
    if (norm.length < 2) return;
    raw.noteAttrCandidates++;
    addOns.push({
      source: 'note_attribute',
      key: mapPropertyToKey(norm),
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
      if (!name || !value || name.length < 2) return;
      const norm = normalizeKey(name);
      raw.noteParsed = true;
      addOns.push({
        source: 'note',
        key: mapPropertyToKey(norm),
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

  // 2.5 Fallback: if order.note exists and we have no addons yet, treat note as card/comment
  const noteStr = order.note && String(order.note).trim();
  if (noteStr && addOns.length === 0) {
    addOns.push({
      source: 'note',
      key: 'card_message',
      label: 'Bemærkning / Note',
      value: noteStr.slice(0, 500),
      quantity: 1,
      price: undefined,
      currency,
      lineItemTitle: undefined,
      sku: undefined,
      rawKey: 'note'
    });
    raw.noteParsed = true;
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
