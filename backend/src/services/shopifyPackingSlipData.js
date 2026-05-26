/**
 * Load Shopify order + embedded images for packing slip print.
 */

const axios = require('axios');
const ShopifyStore = require('../models/ShopifyStore');
const { getShopifyCredentials } = require('../utils/shopify');
const { fetchOrderEnrichment } = require('./orderImageEnricher');

const API_VERSION = '2024-10';

const ADDON_TITLE_KEYWORDS = [
  'flower food', 'plant food', 'blomsternæring', 'næring',
  'greeting card', 'gold flower', 'card', 'kort', 'hilsenkort',
  'vase', 'glasvase', 'chokolade', 'chocolate', 'gaveæske', 'gift box',
  'accessory', 'accessories'
];

async function getCredentialsForOrder(order) {
  const shop = order?.shop || '';
  if (shop) {
    const store = await ShopifyStore.findOne({ shop: String(shop).trim() });
    if (store?.accessToken) return { shop: store.shop, token: store.accessToken };
  }
  return getShopifyCredentials();
}

function orderToPlain(order) {
  return order.toObject ? order.toObject() : { ...order };
}

function lineItemImageUrl(li) {
  if (!li) return null;
  if (typeof li.image === 'string') return li.image;
  return li.image?.src || li.image_url || li.imageUrl || null;
}

async function embedImageAsDataUri(url) {
  if (!url) return null;
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: { Accept: 'image/*', 'User-Agent': 'Northblomst-Portal/1.0' }
    });
    const ct = (res.headers['content-type'] || 'image/jpeg').split(';')[0];
    return `data:${ct};base64,${Buffer.from(res.data).toString('base64')}`;
  } catch (err) {
    console.warn('packing slip embed image failed:', url?.slice(0, 60), err.message);
    return null;
  }
}

function isAddonTitle(title) {
  const t = String(title || '').toLowerCase();
  return ADDON_TITLE_KEYWORDS.some((k) => t.includes(k));
}

function pickMainLineItem(lineItems) {
  for (const li of lineItems || []) {
    if (!isAddonTitle(li.title)) return li;
  }
  return lineItems?.[0] || null;
}

function normalizeProperties(props) {
  if (!props) return [];
  if (Array.isArray(props)) {
    return props
      .map((p) => ({
        name: p.name || p.first || p.key || '',
        value: p.value != null ? p.value : p.last
      }))
      .filter((p) => p.name && p.value != null && String(p.value).trim() !== '');
  }
  if (typeof props === 'object') {
    return Object.entries(props).map(([name, value]) => ({ name, value }));
  }
  return [];
}

function normalizeLineItem(li, imageDataUri) {
  const qty = li.shipping_quantity ?? li.quantity ?? 1;
  const unitPrice = parseFloat(li.price || 0);
  const lineTotal =
    li.final_line_price != null
      ? parseFloat(li.final_line_price)
      : li.line_price != null
        ? parseFloat(li.line_price)
        : unitPrice * qty;

  return {
    title: li.title || li.name || '',
    variant_title: li.variant_title || '',
    quantity: qty,
    line_total: lineTotal,
    unit_price: unitPrice,
    imageUrl: lineItemImageUrl(li),
    imageDataUri,
    properties: normalizeProperties(li.properties)
  };
}

async function enrichLineItemsWithImages(lineItems, creds, shopifyOrderId) {
  const items = lineItems || [];
  let imageUrls = [];

  if (creds?.token && shopifyOrderId) {
    try {
      const enrich = await fetchOrderEnrichment(creds.shop, creds.token, shopifyOrderId);
      imageUrls = (enrich.maps?.byIndex || []).map((e) => e.imageUrl).filter(Boolean);
    } catch (_) {
      /* GraphQL optional */
    }
  }

  const out = [];
  for (let i = 0; i < items.length; i++) {
    const li = { ...items[i] };
    if (!lineItemImageUrl(li) && imageUrls[i]) {
      li.image = { src: imageUrls[i] };
    }
    const src = lineItemImageUrl(li);
    const imageDataUri = await embedImageAsDataUri(src);
    out.push(normalizeLineItem(li, imageDataUri));
  }
  return out;
}

function lineItemsFromMongoProducts(products) {
  return (products || []).map((p) =>
    normalizeLineItem(
      {
        title: p.name,
        quantity: p.quantity || 1,
        price: 0,
        image: p.imageUrl ? { src: p.imageUrl } : null,
        properties: []
      },
      null
    )
  );
}

async function fetchShopifyOrder(creds, shopifyOrderId) {
  const url = `https://${creds.shop}/admin/api/${API_VERSION}/orders/${shopifyOrderId}.json`;
  const { data } = await axios.get(url, {
    headers: { 'X-Shopify-Access-Token': creds.token },
    timeout: 25000
  });
  return data?.order || null;
}

/**
 * @returns {{ mongo: object, lineItems: array, shopifyOrder: object|null, currency: string }}
 */
async function loadOrderPrintPayload(order) {
  const mongo = orderToPlain(order);
  const empty = { mongo, lineItems: [], shopifyOrder: null, currency: mongo.currencyCode || 'DKK' };

  if (!order.shopifyOrderId) {
    const items = lineItemsFromMongoProducts(mongo.products);
    for (const li of items) {
      li.imageDataUri = await embedImageAsDataUri(li.imageUrl);
    }
    return { ...empty, lineItems: items };
  }

  const creds = await getCredentialsForOrder(order);
  if (!creds?.token) {
    console.error('loadOrderPrintPayload: no Shopify token');
    const items = lineItemsFromMongoProducts(mongo.products);
    for (const li of items) {
      li.imageDataUri = await embedImageAsDataUri(li.imageUrl);
    }
    return { ...empty, lineItems: items };
  }

  try {
    const shopifyOrder = await fetchShopifyOrder(creds, order.shopifyOrderId);
    if (!shopifyOrder) return empty;

    const lineItems = await enrichLineItemsWithImages(
      shopifyOrder.line_items,
      creds,
      order.shopifyOrderId
    );

    return {
      mongo,
      shopifyOrder,
      lineItems,
      currency: shopifyOrder.currency || mongo.currencyCode || 'DKK'
    };
  } catch (err) {
    console.error('loadOrderPrintPayload failed', order.shopifyOrderId, err.message);
    const items = lineItemsFromMongoProducts(mongo.products);
    for (const li of items) {
      li.imageDataUri = await embedImageAsDataUri(li.imageUrl);
    }
    return { ...empty, lineItems: items };
  }
}

function getShopifyAdminOrderUrl(order) {
  const id = order.shopifyOrderId;
  if (!id) return null;
  const handle =
    process.env.SHOPIFY_ADMIN_STORE_HANDLE ||
    (process.env.SHOPIFY_STORE_DOMAIN || '').replace('.myshopify.com', '') ||
    '';
  if (handle) return `https://admin.shopify.com/store/${handle}/orders/${id}`;
  const shop = order.shop || '';
  if (shop) return `https://${shop}/admin/orders/${id}`;
  return null;
}

module.exports = {
  loadOrderPrintPayload,
  getShopifyAdminOrderUrl,
  pickMainLineItem,
  isAddonTitle
};
