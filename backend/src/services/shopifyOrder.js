/**
 * Fetch order details from Shopify Admin API using token from ShopifyStore (Mongo).
 */

const axios = require('axios');
const ShopifyStore = require('../models/ShopifyStore');

const API_VERSION = '2024-01';

/**
 * Fetch order by id from Shopify for a given shop.
 * Uses access token from ShopifyStore.
 * @param {string} shop - shop domain (e.g. northblomst-dev.myshopify.com)
 * @param {string|number} orderId - Shopify order id (numeric)
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
async function fetchOrderFromShopify(shop, orderId) {
  const store = await ShopifyStore.findOne({ shop: String(shop).trim() });
  if (!store || !store.accessToken) {
    return { success: false, error: `No Shopify store or token for shop: ${shop}` };
  }

  const url = `https://${store.shop}/admin/api/${API_VERSION}/orders/${orderId}.json`;
  try {
    const { data } = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': store.accessToken
      },
      timeout: 15000
    });
    return { success: true, data: data.order };
  } catch (err) {
    const msg = err.response?.data?.errors || err.response?.data?.message || err.message;
    return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
  }
}

/**
 * Extract minimal order details for storage.
 * Maps: id, name, createdAt, displayFinancialStatus, totalPriceSet, currency,
 * shippingAddress (name, address1, zip, city, phone), note, tags, lineItems (title, quantity).
 */
function mapOrderDetails(shopifyOrder) {
  if (!shopifyOrder) return null;
  const shipping = shopifyOrder.shipping_address || {};
  const lineItems = (shopifyOrder.line_items || []).map((li) => ({
    title: li.title,
    quantity: li.quantity || 1
  }));
  return {
    id: shopifyOrder.id,
    name: shopifyOrder.name,
    createdAt: shopifyOrder.created_at,
    displayFinancialStatus: shopifyOrder.financial_status,
    totalPriceSet: shopifyOrder.total_price_set || (shopifyOrder.total_price != null ? { shop_money: { amount: shopifyOrder.total_price, currency_code: shopifyOrder.currency } } : null),
    currency: shopifyOrder.currency,
    shippingAddress: {
      name: shipping.name || `${(shipping.first_name || '')} ${(shipping.last_name || '')}`.trim(),
      address1: shipping.address1,
      zip: shipping.zip,
      city: shipping.city,
      phone: shipping.phone
    },
    note: shopifyOrder.note,
    tags: shopifyOrder.tags,
    lineItems
  };
}

/**
 * Build printableData for print.
 */
function buildPrintableData(orderDetails) {
  if (!orderDetails) return {};
  const sa = orderDetails.shippingAddress || {};
  const totalPriceSet = orderDetails.totalPriceSet;
  const total = totalPriceSet?.shop_money?.amount ?? totalPriceSet?.amount ?? totalPriceSet;
  return {
    orderName: orderDetails.name,
    createdAt: orderDetails.createdAt,
    total,
    currency: orderDetails.currency,
    recipientName: sa.name,
    address: sa.address1,
    zip: sa.zip,
    city: sa.city,
    phone: sa.phone,
    note: orderDetails.note,
    tags: orderDetails.tags,
    lineItems: orderDetails.lineItems || []
  };
}

module.exports = {
  fetchOrderFromShopify,
  mapOrderDetails,
  buildPrintableData
};
