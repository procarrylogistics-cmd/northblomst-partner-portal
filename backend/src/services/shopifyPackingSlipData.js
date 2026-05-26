/**
 * Load order data for print using Shopify REST (line_items include images like admin packing slip).
 */

const axios = require('axios');
const ShopifyStore = require('../models/ShopifyStore');
const { getShopifyCredentials } = require('../utils/shopify');
const { enrichOrderImages } = require('./orderImageEnricher');

const API_VERSION = '2024-10';

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
  return li.image?.src || li.image_url || null;
}

function mapsFromShopifyLineItems(lineItems) {
  const byVariant = new Map();
  const byProduct = new Map();
  const byIndex = [];

  for (const li of lineItems || []) {
    const entry = {
      imageUrl: lineItemImageUrl(li),
      name: li.title || li.name,
      quantity: li.quantity || 1
    };
    byIndex.push(entry);
    if (li.variant_id != null) byVariant.set(String(li.variant_id), entry);
    if (li.product_id != null) byProduct.set(String(li.product_id), entry);
  }

  return { byVariant, byProduct, byIndex };
}

function mergeLineItemImages(products, maps) {
  if (!products?.length) return products;
  return products.map((p, i) => {
    const out = { ...p };
    if (out.imageUrl) return out;

    let picked = null;
    if (p.variantId && maps.byVariant.has(String(p.variantId))) {
      picked = maps.byVariant.get(String(p.variantId));
    } else if (p.productId && maps.byProduct.has(String(p.productId))) {
      picked = maps.byProduct.get(String(p.productId));
    } else if (maps.byIndex[i]) {
      picked = maps.byIndex[i];
    }

    if (picked?.imageUrl) out.imageUrl = picked.imageUrl;
    return out;
  });
}

/**
 * Plain order object with product images from Shopify REST (same source as packing slip in admin).
 */
async function loadOrderPrintPayload(order) {
  const plain = orderToPlain(order);

  if (!order.shopifyOrderId) return plain;

  await enrichOrderImages(order);
  const refreshed = orderToPlain(order);
  Object.assign(plain, refreshed);
  plain.products = refreshed.products || plain.products;

  const creds = await getCredentialsForOrder(order);
  if (!creds?.token) return plain;

  try {
    const url = `https://${creds.shop}/admin/api/${API_VERSION}/orders/${order.shopifyOrderId}.json`;
    const { data } = await axios.get(url, {
      headers: { 'X-Shopify-Access-Token': creds.token },
      timeout: 20000
    });
    const shopifyOrder = data?.order;
    if (!shopifyOrder) return plain;

    const maps = mapsFromShopifyLineItems(shopifyOrder.line_items);
    plain.products = mergeLineItemImages(plain.products || [], maps);

    if (shopifyOrder.total_price != null && plain.totalPaidAmount == null) {
      plain.totalPaidAmount = parseFloat(shopifyOrder.total_price);
    }
    if (shopifyOrder.currency && !plain.currencyCode) {
      plain.currencyCode = shopifyOrder.currency;
    }

    return plain;
  } catch (err) {
    console.error('loadOrderPrintPayload REST failed', order.shopifyOrderId, err.message);
    return plain;
  }
}

function getShopifyAdminOrderUrl(order) {
  const id = order.shopifyOrderId;
  if (!id) return null;
  const handle =
    process.env.SHOPIFY_ADMIN_STORE_HANDLE ||
    (process.env.SHOPIFY_STORE_DOMAIN || '').replace('.myshopify.com', '') ||
    '';
  if (handle) {
    return `https://admin.shopify.com/store/${handle}/orders/${id}`;
  }
  const shop = order.shop || '';
  if (shop) {
    return `https://${shop}/admin/orders/${id}`;
  }
  return null;
}

module.exports = {
  loadOrderPrintPayload,
  getShopifyAdminOrderUrl
};
