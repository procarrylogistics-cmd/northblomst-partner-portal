/**
 * Enrich order line items with Shopify product images + total paid via GraphQL.
 * Uses OAuth token from ShopifyStore. Requires read_orders + read_products.
 */

const axios = require('axios');
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
          image {
            url
          }
        }
        product {
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

/**
 * Resolve image URL: LineItem.image > variant.image > product.featuredImage
 */
function resolveImageUrl(node) {
  return (
    node?.image?.url ||
    node?.variant?.image?.url ||
    node?.product?.featuredImage?.url ||
    null
  );
}

/**
 * Fetch images and total paid for order from Shopify GraphQL.
 * @param {string} shop - shop domain
 * @param {string} shopifyOrderId - numeric order id from REST
 * @returns {Promise<{ imageUrls: string[], productUrls: string[], totalPaidAmount: number|null, currencyCode: string|null }>}
 */
async function fetchOrderEnrichment(shop, shopifyOrderId) {
  const creds = await getShopifyCredentials();
  const empty = {
    imageUrls: [],
    productUrls: [],
    totalPaidAmount: null,
    currencyCode: null
  };
  if (!creds || !creds.token) return empty;
  const gid = toOrderGid(shopifyOrderId);
  if (!gid) return empty;

  const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;
  const { data } = await axios.post(
    url,
    { query: ORDER_ENRICH_QUERY, variables: { id: gid } },
    { headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': creds.token } }
  );

  const order = data?.data?.order;
  if (!order) return empty;

  const nodes = order.lineItems?.nodes || [];
  const imageUrls = nodes.map((n) => resolveImageUrl(n));
  const productUrls = nodes.map((n) => n.product?.onlineStoreUrl || null);

  const priceSet = order.totalPriceSet;
  const pm = priceSet?.presentmentMoney || priceSet?.shopMoney;
  const amount = pm?.amount != null ? parseFloat(pm.amount) : null;
  const currencyCode = pm?.currencyCode || null;

  return { imageUrls, productUrls, totalPaidAmount: amount, currencyCode };
}

/**
 * Enrich order document with imageUrl, productUrl per product and totalPaidAmount, currencyCode.
 * Runs async, does not throw – errors are logged.
 * @param {object} order - Mongoose Order doc
 */
async function enrichOrderImages(order) {
  if (!order || !order.shopifyOrderId) return;
  const shop = order.shop || '';
  if (!shop) return;

  try {
    const { imageUrls, productUrls, totalPaidAmount, currencyCode } = await fetchOrderEnrichment(
      shop,
      order.shopifyOrderId
    );
    let changed = false;

    if (order.products?.length) {
      for (let i = 0; i < order.products.length; i++) {
        if (imageUrls[i] && !order.products[i].imageUrl) {
          order.products[i].imageUrl = imageUrls[i];
          changed = true;
        }
        if (productUrls[i] && !order.products[i].productUrl) {
          order.products[i].productUrl = productUrls[i];
          changed = true;
        }
      }
      if (changed) order.markModified('products');
    }

    if (totalPaidAmount != null && order.totalPaidAmount == null) {
      order.totalPaidAmount = totalPaidAmount;
      changed = true;
    }
    if (currencyCode && !order.currencyCode) {
      order.currencyCode = currencyCode;
      changed = true;
    }

    if (changed) await order.save();
  } catch (err) {
    console.error('orderImageEnricher: failed for order', order.shopifyOrderId, err.message);
  }
}

module.exports = {
  fetchOrderEnrichment,
  enrichOrderImages,
  ORDER_ENRICH_QUERY
};
