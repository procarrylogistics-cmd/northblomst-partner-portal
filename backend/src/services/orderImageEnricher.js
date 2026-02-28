/**
 * Enrich order line items with Shopify product images via GraphQL.
 * Uses OAuth token from ShopifyStore. Requires read_orders + read_products.
 */

const axios = require('axios');
const { getShopifyCredentials } = require('../utils/shopify');

const API_VERSION = '2024-10';

const ORDER_IMAGES_QUERY = `
query getOrderLineItemImages($id: ID!) {
  order(id: $id) {
    lineItems(first: 50) {
      nodes {
        image {
          url
        }
        product {
          featuredImage {
            url
          }
          onlineStoreUrl
        }
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

/**
 * Fetch image URLs for order line items from Shopify GraphQL.
 * @param {string} shop - shop domain (e.g. northblomst-dev.myshopify.com)
 * @param {string} shopifyOrderId - numeric order id from REST
 * @returns {Promise<{ imageUrls: string[], productUrls: string[] }>}
 */
async function fetchOrderLineItemImages(shop, shopifyOrderId) {
  const creds = await getShopifyCredentials();
  if (!creds || !creds.token) {
    return { imageUrls: [], productUrls: [] };
  }
  const gid = toOrderGid(shopifyOrderId);
  if (!gid) return { imageUrls: [], productUrls: [] };

  const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;
  const { data } = await axios.post(
    url,
    { query: ORDER_IMAGES_QUERY, variables: { id: gid } },
    { headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': creds.token } }
  );

  const nodes = data?.data?.order?.lineItems?.nodes || [];
  const imageUrls = nodes.map((n) => n.image?.url || n.product?.featuredImage?.url || null);
  const productUrls = nodes.map((n) => n.product?.onlineStoreUrl || null);
  return { imageUrls, productUrls };
}

/**
 * Enrich order document with imageUrl and productUrl per product.
 * Runs async, does not throw – errors are logged.
 * @param {object} order - Mongoose Order doc
 */
async function enrichOrderImages(order) {
  if (!order || !order.shopifyOrderId || !order.products?.length) return;
  const shop = order.shop || '';
  if (!shop) return;

  try {
    const { imageUrls, productUrls } = await fetchOrderLineItemImages(shop, order.shopifyOrderId);
    let changed = false;
    const products = order.products;
    for (let i = 0; i < products.length; i++) {
      if (imageUrls[i] && !products[i].imageUrl) {
        products[i].imageUrl = imageUrls[i];
        changed = true;
      }
      if (productUrls[i] && !products[i].productUrl) {
        products[i].productUrl = productUrls[i];
        changed = true;
      }
    }
    if (changed) {
      order.markModified('products');
      await order.save();
    }
  } catch (err) {
    console.error('orderImageEnricher: failed for order', order.shopifyOrderId, err.message);
  }
}

module.exports = {
  fetchOrderLineItemImages,
  enrichOrderImages,
  ORDER_IMAGES_QUERY
};
