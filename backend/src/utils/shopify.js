/**
 * Shopify Admin API utilities: token, webhooks (create, list, delete).
 * Uses REST Admin API. For client_credentials flow, extend getShopifyAccessToken.
 */

const axios = require('axios');

const API_VERSION = '2024-10';
const SHOP = process.env.SHOPIFY_STORE_DOMAIN || 'northblomst-dev.myshopify.com';

/**
 * Returnează access token pentru Shopify Admin API.
 * Folosește SHOPIFY_ACCESS_TOKEN (custom app: Settings > Apps > Develop apps > API credentials).
 * Pentru client_credentials: poți extinde cu token refresh (Shopify OAuth docs).
 * @returns {Promise<string>}
 */
async function getShopifyAccessToken() {
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'SHOPIFY_ACCESS_TOKEN lipsește. Custom app: Settings > Apps > Develop apps > Admin API access token.'
    );
  }
  return token;
}

function getBaseUrl() {
  return `https://${SHOP}/admin/api/${API_VERSION}`;
}

/**
 * Creează un webhook în Shopify.
 * @param {string} topic - Ex: 'orders/create', 'orders/updated', 'orders/cancelled'
 * @param {string} address - URL complet (ex: https://ngrok-url/api/webhooks/shopify)
 * @returns {Promise<object>} webhook creat
 */
async function createWebhook(topic, address) {
  const token = await getShopifyAccessToken();
  const url = `${getBaseUrl()}/webhooks.json`;
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
  const token = await getShopifyAccessToken();
  const url = `${getBaseUrl()}/webhooks.json?limit=250`;
  const { data } = await axios.get(url, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  return data.webhooks || [];
}

/**
 * Șterge un webhook după id.
 * @param {string|number} id
 * @returns {Promise<void>}
 */
async function deleteWebhook(id) {
  const token = await getShopifyAccessToken();
  const url = `${getBaseUrl()}/webhooks/${id}.json`;
  await axios.delete(url, {
    headers: { 'X-Shopify-Access-Token': token }
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
  createWebhook,
  getWebhooks,
  deleteWebhook,
  webhookExists,
  getBaseUrl,
  API_VERSION,
  SHOP
};
