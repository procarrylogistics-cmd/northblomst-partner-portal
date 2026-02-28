/**
 * Extract delivery date from Shopify order payload.
 * Timezone: Europe/Copenhagen
 * Sources: note_attributes, line item properties, metafields, estimated_delivery_at
 */

const DELIVERY_KEYS = [
  'leveringsdato', 'levering dato', 'delivery date', 'delivery_date',
  'leveringsdato', 'leveringsvalg', 'delivery', 'afhentningsdato',
  'delivery date', 'estimated_delivery', 'levering'
];

function normalizeKey(s) {
  if (typeof s !== 'string') return '';
  return s.toLowerCase().trim().replace(/_/g, ' ').replace(/\s+/g, ' ');
}

function parseDateCopenhagen(val) {
  if (!val || typeof val !== 'string') return null;
  const v = val.trim();
  // ISO YYYY-MM-DD
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(iso[1] + '-' + iso[2] + '-' + iso[3] + 'T12:00:00.000Z');
    return isNaN(d.getTime()) ? null : d;
  }
  // DD.MM.YYYY or DD/MM/YYYY
  const dmy = v.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  // YYYY.MM.DD
  const ymd = v.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (ymd) {
    const [, year, month, day] = ymd;
    const d = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function getTodayCopenhagen() {
  const fmt = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Copenhagen' });
  return new Date(fmt + 'T12:00:00.000Z');
}

function getTomorrowCopenhagen() {
  const d = new Date();
  const tomorrow = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' }));
  tomorrow.setDate(tomorrow.getDate() + 1);
  const fmt = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Europe/Copenhagen' });
  return new Date(fmt + 'T12:00:00.000Z');
}

/**
 * Extract delivery date and option from Shopify order
 * @param {object} order - Shopify order payload
 * @returns {{ deliveryDate: Date|null, deliveryOption: string|null }}
 */
function extractDeliveryFromShopifyOrder(order) {
  let deliveryDate = null;
  let deliveryOption = null;

  // 1. Shopify standard
  if (order.estimated_delivery_at) {
    const d = new Date(order.estimated_delivery_at);
    if (!isNaN(d.getTime())) {
      deliveryDate = d;
      deliveryOption = 'DATE';
    }
  }

  // 2. note_attributes
  (order.note_attributes || []).forEach((na) => {
    const name = normalizeKey((na.name || na).toString());
    const value = (na.value != null ? na.value : '').toString().trim();
    if (!value || !DELIVERY_KEYS.some((k) => name.includes(k))) return;
    const lower = value.toLowerCase();
    if (lower === 'today' || lower === 'i dag' || lower === 'idag') {
      deliveryDate = getTodayCopenhagen();
      deliveryOption = 'TODAY';
    } else if (lower === 'tomorrow' || lower === 'i morgen' || lower === 'imorgen') {
      deliveryDate = getTomorrowCopenhagen();
      deliveryOption = 'TOMORROW';
    } else {
      const parsed = parseDateCopenhagen(value);
      if (parsed) {
        deliveryDate = parsed;
        deliveryOption = 'DATE';
      }
    }
  });

  // 3. line_items properties
  (order.line_items || []).forEach((li) => {
    const rawProps = li.properties || [];
    const props = Array.isArray(rawProps) ? rawProps : (typeof rawProps === 'object' && rawProps !== null ? Object.entries(rawProps).map(([k, v]) => ({ name: k, value: v })) : []);
    props.forEach((prop) => {
      const name = normalizeKey((prop?.name ?? prop)?.toString());
      const value = (prop?.value ?? '').toString().trim();
      if (!value || !DELIVERY_KEYS.some((k) => name.includes(k))) return;
      const lower = value.toLowerCase();
      if (lower === 'today' || lower === 'i dag') {
        deliveryDate = getTodayCopenhagen();
        deliveryOption = 'TODAY';
      } else if (lower === 'tomorrow' || lower === 'i morgen') {
        deliveryDate = getTomorrowCopenhagen();
        deliveryOption = 'TOMORROW';
      } else {
        const parsed = parseDateCopenhagen(value);
        if (parsed) {
          deliveryDate = parsed;
          deliveryOption = 'DATE';
        }
      }
    });
  });

  // 4. metafields (if present)
  const meta = order.metafields || order.metafields_global_title_tag;
  if (meta && Array.isArray(meta)) {
    meta.forEach((m) => {
      const key = normalizeKey((m.namespace || '') + ' ' + (m.key || ''));
      const value = (m.value || '').toString().trim();
      if (!value || !DELIVERY_KEYS.some((k) => key.includes(k))) return;
      const parsed = parseDateCopenhagen(value);
      if (parsed) {
        deliveryDate = parsed;
        deliveryOption = 'DATE';
      }
    });
  }

  // 5. attributes (checkout attributes)
  const attrs = order.attributes || order.note_attributes;
  if (attrs) {
    const list = Array.isArray(attrs) ? attrs : Object.entries(attrs || {}).map(([k, v]) => ({ name: k, value: v }));
    list.forEach((a) => {
      const name = normalizeKey((a.name ?? a).toString());
      const value = (a.value ?? a).toString().trim();
      if (!value) return;
      if (DELIVERY_KEYS.some((k) => name.includes(k))) {
        const lower = value.toLowerCase();
        if (lower === 'today' || lower === 'i dag') {
          deliveryDate = getTodayCopenhagen();
          deliveryOption = 'TODAY';
        } else if (lower === 'tomorrow' || lower === 'i morgen') {
          deliveryDate = getTomorrowCopenhagen();
          deliveryOption = 'TOMORROW';
        } else {
          const parsed = parseDateCopenhagen(value);
          if (parsed) {
            deliveryDate = parsed;
            deliveryOption = 'DATE';
          }
        }
      }
    });
  }

  // 6. Fallback: createdAt (mark as unknown - caller can decide)
  if (!deliveryDate && order.created_at) {
    deliveryDate = new Date(order.created_at);
    deliveryOption = null;
  }

  return { deliveryDate, deliveryOption };
}

/**
 * Same logic for backfill - accepts Order doc from DB.
 * Uses raw.note_attributes, raw.line_items, raw.estimated_delivery_at, created_at
 */
function extractDeliveryFromOrderDoc(doc) {
  const fake = {
    note_attributes: doc.raw?.note_attributes || doc.note_attributes,
    line_items: doc.raw?.line_items || [],
    estimated_delivery_at: doc.raw?.estimated_delivery_at,
    created_at: doc.createdAt || doc.receivedAt || doc.orderDate
  };
  return extractDeliveryFromShopifyOrder(fake);
}

module.exports = {
  extractDeliveryFromShopifyOrder,
  extractDeliveryFromOrderDoc,
  parseDateCopenhagen,
  getTodayCopenhagen,
  getTomorrowCopenhagen
};
