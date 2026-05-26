/**
 * Enrich order line items with Shopify product images + total paid.
 * Requires read_orders; read_products helps for variant/product images.
 */

const axios = require('axios');
const ShopifyStore = require('../models/ShopifyStore');
const { getShopifyCredentials } = require('../utils/shopify');

const API_VERSION = '2024-10';

const ORDER_ENRICH_QUERY = `
query getOrderEnrich($id: ID!) {
  order(id: $id) {
    lineItems(first: 50) {
      nodes {
        image {
          url
        }
        variant {
          legacyResourceId
          image {
            url
          }
        }
        product {
          legacyResourceId
          featuredImage {
            url
          }
          onlineStoreUrl
        }
      }
    }
    totalPriceSet {
      presentmentMoney {
        amount
        currencyCode
      }
      shopMoney {
        amount
        currencyCode
      }
    }
  }
}
`;

function toOrderGid(shopifyOrderId) {
  const id = String(shopifyOrderId || '').trim();
  if (!id || id.startsWith('gid://')) return id || null;
  return `gid://shopify/Order/${id}`;
}

function resolveImageUrl(node) {
  const variantUrl = node?.variant?.image?.url;
  const productUrl = node?.product?.featuredImage?.url;
  const lineItemUrl = node?.image?.url;
  return variantUrl || lineItemUrl || productUrl || null;
}

function lineItemImageFromRest(li) {
  if (!li) return null;
  if (typeof li.image === 'string') return li.image;
  if (li.image?.src) return li.image.src;
  if (li.image_url) return li.image_url;
  return null;
}

async function getCredentialsForOrder(order) {
  const shop = order?.shop || '';
  if (shop) {
    const store = await ShopifyStore.findOne({ shop: String(shop).trim() });
    if (store?.accessToken) return { shop: store.shop, token: store.accessToken };
  }
  return getShopifyCredentials();
}

async function fetchVariantImageRest(shop, token, variantId) {
  if (!variantId || !token) return null;
  try {
    const url = `https://${shop}/admin/api/${API_VERSION}/variants/${variantId}.json`;
    const { data } = await axios.get(url, {
      headers: { 'X-Shopify-Access-Token': token },
      timeout: 12000
    });
    return data?.variant?.image?.src || null;
  } catch (err) {
    if (process.env.DEBUG_IMAGE_ENRICH === 'true') {
      console.warn('orderImageEnricher REST variant', variantId, err.message);
    }
    return null;
  }
}

async function fetchProductImageRest(shop, token, productId) {
  if (!productId || !token) return null;
  try {
    const url = `https://${shop}/admin/api/${API_VERSION}/products/${productId}.json`;
    const { data } = await axios.get(url, {
      headers: { 'X-Shopify-Access-Token': token },
      timeout: 12000
    });
    return data?.product?.image?.src || data?.product?.images?.[0]?.src || null;
  } catch (err) {
    if (process.env.DEBUG_IMAGE_ENRICH === 'true') {
      console.warn('orderImageEnricher REST product', productId, err.message);
    }
    return null;
  }
}

/**
 * Build maps variantId/productId -> { imageUrl, productUrl } from GraphQL line nodes.
 */
function mapsFromGraphQLNodes(nodes) {
  const byVariant = new Map();
  const byProduct = new Map();
  const byIndex = [];

  for (const node of nodes || []) {
    const imageUrl = resolveImageUrl(node);
    const productUrl = node?.product?.onlineStoreUrl || null;
    const entry = { imageUrl, productUrl };
    byIndex.push(entry);

    const vid = node?.variant?.legacyResourceId;
    if (vid != null) byVariant.set(String(vid), entry);

    const pid = node?.product?.legacyResourceId;
    if (pid != null) byProduct.set(String(pid), entry);
  }

  return { byVariant, byProduct, byIndex };
}

function pickImageForProduct(product, maps) {
  const vid = product?.variantId != null ? String(product.variantId) : '';
  const pid = product?.productId != null ? String(product.productId) : '';

  if (vid && maps.byVariant.has(vid)) {
    return maps.byVariant.get(vid);
  }
  if (pid && maps.byProduct.has(pid)) {
    return maps.byProduct.get(pid);
  }
  return null;
}

async function fetchOrderEnrichment(shop, token, shopifyOrderId) {
  const empty = {
    maps: { byVariant: new Map(), byProduct: new Map(), byIndex: [] },
    totalPaidAmount: null,
    currencyCode: null
  };
  if (!token || !shop) return empty;
  const gid = toOrderGid(shopifyOrderId);
  if (!gid) return empty;

  const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;
  const { data } = await axios.post(
    url,
    { query: ORDER_ENRICH_QUERY, variables: { id: gid } },
    { headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token } }
  );

  if (data?.errors?.length) {
    console.error('orderImageEnricher GraphQL errors:', JSON.stringify(data.errors).slice(0, 500));
    return empty;
  }

  const order = data?.data?.order;
  if (!order) return empty;

  const nodes = order.lineItems?.nodes || [];
  const maps = mapsFromGraphQLNodes(nodes);

  const priceSet = order.totalPriceSet;
  const pm = priceSet?.presentmentMoney || priceSet?.shopMoney;
  const amount = pm?.amount != null ? parseFloat(pm.amount) : null;
  const currencyCode = pm?.currencyCode || null;

  return { maps, totalPaidAmount: amount, currencyCode };
}

async function resolveShopForOrder(order) {
  if (order?.shop) return order.shop;
  const creds = await getShopifyCredentials();
  return creds?.shop || process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_SHOP || '';
}

function orderNeedsImageEnrichment(order) {
  if (!order?.shopifyOrderId || !order.products?.length) return false;
  return order.products.some((p) => !p.imageUrl);
}

async function applyImagesToProducts(order, maps, creds) {
  const shop = creds?.shop || order.shop;
  const token = creds?.token;
  let changed = false;

  for (let i = 0; i < order.products.length; i++) {
    const p = order.products[i];
    if (p.imageUrl) continue;

    let picked = pickImageForProduct(p, maps);
    if (!picked?.imageUrl && maps.byIndex[i]) {
      picked = maps.byIndex[i];
    }

    if (picked?.imageUrl && !p.imageUrl) {
      p.imageUrl = picked.imageUrl;
      changed = true;
    }
    if (picked?.productUrl && !p.productUrl) {
      p.productUrl = picked.productUrl;
      changed = true;
    }

    if (!p.imageUrl && p.variantId && token) {
      const restUrl = await fetchVariantImageRest(shop, token, p.variantId);
      if (restUrl) {
        p.imageUrl = restUrl;
        changed = true;
      }
    }
    if (!p.imageUrl && p.productId && token) {
      const restUrl = await fetchProductImageRest(shop, token, p.productId);
      if (restUrl) {
        p.imageUrl = restUrl;
        changed = true;
      }
    }
  }

  if (changed) order.markModified('products');
  return changed;
}

async function enrichOrderImages(order) {
  if (!order || !order.shopifyOrderId || !order.products?.length) return false;
  if (!order.products.some((p) => !p.imageUrl)) return false;

  const creds = await getCredentialsForOrder(order);
  if (!creds?.token) {
    console.error('orderImageEnricher: no Shopify token for order', order.shopifyOrderId);
    return false;
  }

  const shop = await resolveShopForOrder(order);
  if (!shop) {
    console.error('orderImageEnricher: no shop for order', order.shopifyOrderId);
    return false;
  }
  if (!order.shop) order.shop = shop;

  try {
    const { maps, totalPaidAmount, currencyCode } = await fetchOrderEnrichment(
      shop,
      creds.token,
      order.shopifyOrderId
    );

    let changed = await applyImagesToProducts(order, maps, creds);

    if (totalPaidAmount != null && order.totalPaidAmount == null) {
      order.totalPaidAmount = totalPaidAmount;
      changed = true;
    }
    if (currencyCode && !order.currencyCode) {
      order.currencyCode = currencyCode;
      changed = true;
    }

    const stillMissing = order.products.some((p) => !p.imageUrl);
    if (stillMissing) {
      console.warn(
        'orderImageEnricher: images still missing after enrich',
        order.shopifyOrderId,
        order.shopifyOrderName || order.shopifyOrderNumber
      );
    } else if (process.env.DEBUG_IMAGE_ENRICH === 'true') {
      console.log('orderImageEnricher OK', order.shopifyOrderId, order.products[0]?.imageUrl);
    }

    if (changed) await order.save();
    return changed;
  } catch (err) {
    console.error('orderImageEnricher: failed for order', order.shopifyOrderId, err.message);
    return false;
  }
}

/** Extract image URL from Shopify webhook/REST line_item when present */
function imageUrlFromShopifyLineItem(li) {
  return lineItemImageFromRest(li);
}

module.exports = {
  fetchOrderEnrichment,
  enrichOrderImages,
  resolveShopForOrder,
  orderNeedsImageEnrichment,
  imageUrlFromShopifyLineItem,
  ORDER_ENRICH_QUERY
};
