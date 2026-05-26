/**
 * Set productUrl on order line items (storefront or search). No images required.
 */

const axios = require('axios');
const ShopifyStore = require('../models/ShopifyStore');
const { getShopifyCredentials } = require('../utils/shopify');

const API_VERSION = '2024-10';
const STOREFRONT = (process.env.SHOPIFY_STOREFRONT_URL || 'https://northblomst.dk').replace(/\/$/, '');

function searchUrl(productName) {
  return `${STOREFRONT}/search?q=${encodeURIComponent(productName || '')}`;
}

async function getCredentialsForOrder(order) {
  const shop = order?.shop || '';
  if (shop) {
    const store = await ShopifyStore.findOne({ shop: String(shop).trim() });
    if (store?.accessToken) return { shop: store.shop, token: store.accessToken };
  }
  return getShopifyCredentials();
}

async function fetchProductHandle(shop, token, productId) {
  const url = `https://${shop}/admin/api/${API_VERSION}/products/${productId}.json?fields=id,handle`;
  const { data } = await axios.get(url, {
    headers: { 'X-Shopify-Access-Token': token },
    timeout: 10000
  });
  return data?.product?.handle || null;
}

function orderNeedsProductLinks(order) {
  return (order?.products || []).some((p) => !p.productUrl);
}

async function enrichProductLinks(order) {
  if (!order?.products?.length || !orderNeedsProductLinks(order)) return false;

  const creds = await getCredentialsForOrder(order);
  let changed = false;

  for (const p of order.products) {
    if (p.productUrl) continue;

    if (p.productId && creds?.token && creds?.shop) {
      try {
        const handle = await fetchProductHandle(creds.shop, creds.token, p.productId);
        if (handle) {
          p.productUrl = `${STOREFRONT}/products/${handle}`;
          changed = true;
          continue;
        }
      } catch (_) {
        /* fallback to search */
      }
    }

    p.productUrl = searchUrl(p.name);
    changed = true;
  }

  if (changed) {
    order.markModified('products');
    await order.save();
  }
  return changed;
}

module.exports = {
  STOREFRONT,
  searchUrl,
  enrichProductLinks,
  orderNeedsProductLinks
};
