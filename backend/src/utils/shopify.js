/**
 * Shopify Admin API utilities: token, webhooks (create, list, delete).
 * Uses OAuth token from ShopifyStore (DB) by default; env SHOPIFY_ACCESS_TOKEN as fallback.
 */

const axios = require('axios');
const ShopifyStore = require('../models/ShopifyStore');

const API_VERSION = '2024-10';

const NOT_CONNECTED_MSG = 'Shop not connected. Please run /auth/shopify first.';

/**
 * Returnează { shop, token } pentru Shopify Admin API.
 * Prioritate: 1) ShopifyStore (accessToken din DB), 2) SHOPIFY_ACCESS_TOKEN din env.
 * @returns {Promise<{ shop: string, token: string } | null>}
 */
async function getShopifyCredentials() {
  const store = await ShopifyStore.findOne().sort({ installedAt: -1 });
  if (store && store.accessToken) {
    return { shop: store.shop, token: store.accessToken };
  }
  const envToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const envShop = process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_SHOP || 'northblomst-dev.myshopify.com';
  if (envToken && envShop) {
    return { shop: envShop, token: envToken };
  }
  return null;
}

function getBaseUrl(shop) {
  return `https://${shop}/admin/api/${API_VERSION}`;
}

/**
 * @deprecated Use getShopifyCredentials(). Preferat: token din DB.
 */
async function getShopifyAccessToken() {
  const creds = await getShopifyCredentials();
  if (!creds) {
    throw new Error(NOT_CONNECTED_MSG);
  }
  return creds.token;
}

/**
 * Creează un webhook în Shopify.
 * @param {string} topic - Ex: 'orders/create', 'orders/updated', 'orders/cancelled'
 * @param {string} address - URL complet (ex: https://ngrok-url/api/webhooks/shopify)
 * @returns {Promise<object>} webhook creat
 */
async function createWebhook(topic, address) {
  const creds = await getShopifyCredentials();
  if (!creds) {
    throw new Error(NOT_CONNECTED_MSG);
  }
  const token = creds.token;
  const url = `${getBaseUrl(creds.shop)}/webhooks.json`;
  const { data } = await axios.post(
    url,
    {
      webhook: {
        topic,
        address,
        format: 'json'
      }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      }
    }
  );
  return data.webhook;
}

/**
 * Listează webhooks existente.
 * @returns {Promise<object[]>}
 */
async function getWebhooks() {
  const creds = await getShopifyCredentials();
  if (!creds) {
    throw new Error(NOT_CONNECTED_MSG);
  }
  const url = `${getBaseUrl(creds.shop)}/webhooks.json?limit=250`;
  const { data } = await axios.get(url, {
    headers: { 'X-Shopify-Access-Token': creds.token }
  });
  return data.webhooks || [];
}

/**
 * Șterge un webhook după id.
 * @param {string|number} id
 * @returns {Promise<void>}
 */
async function deleteWebhook(id) {
  const creds = await getShopifyCredentials();
  if (!creds) {
    throw new Error(NOT_CONNECTED_MSG);
  }
  const url = `${getBaseUrl(creds.shop)}/webhooks/${id}.json`;
  await axios.delete(url, {
    headers: { 'X-Shopify-Access-Token': creds.token }
  });
}

/**
 * Verifică dacă există deja un webhook cu topic și address date.
 * @param {string} topic
 * @param {string} address
 * @param {object[]} webhooks
 * @returns {boolean}
 */
function webhookExists(topic, address, webhooks) {
  return webhooks.some(
    (w) => w.topic === topic && (w.address === address || (w.address || '').endsWith(address))
  );
}

module.exports = {
  getShopifyAccessToken,
  getShopifyCredentials,
  createWebhook,
  getWebhooks,
  deleteWebhook,
  webhookExists,
  getBaseUrl,
  API_VERSION
};
