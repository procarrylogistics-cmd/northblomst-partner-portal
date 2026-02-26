/**
 * Client pentru Shopify Admin API prin proxy-ul Shopify CLI (shopify app dev).
 * Proxy-ul gestionează autentificarea; nu e nevoie de token în cod.
 *
 * PORT FIX (recomandat):
 * Pornește CLI cu port fix ca să nu se schimbe la fiecare restart:
 *   cd profitable-vertical-app
 *   shopify app dev --store=northblomst-dev.myshopify.com --use-localhost --localhost-port=3456
 *
 * Verifică în output URL-ul proxy (ex: http://localhost:3456) și pune în .env:
 *   SHOPIFY_PROXY_URL=http://localhost:3456
 *
 * Dacă portul 3456 e ocupat, folosește altul (ex: 3457).
 */

const axios = require('axios');

// Folosește SHOPIFY_PROXY_URL din .env; fallback la port fix 3456
const DEFAULT_PROXY_PORT = 3456;
const SHOPIFY_PROXY = process.env.SHOPIFY_PROXY_URL || `http://localhost:${DEFAULT_PROXY_PORT}`;
const API_VERSION = '2025-01';

const defaultHeaders = { 'Content-Type': 'application/json' };

/** Returnează URL-ul pentru un path API. */
function apiUrl(path) {
  const base = path.startsWith('http') ? path : `${SHOPIFY_PROXY}/admin/api/${API_VERSION}${path.startsWith('/') ? path : `/${path}`}`;
  return base;
}

/**
 * Informații despre shop.
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
async function getShopInfo() {
  try {
    const { data } = await axios.get(apiUrl('/shop.json'), { headers: defaultHeaders });
    return { success: true, data: data.shop };
  } catch (err) {
    const msg = err.response?.data?.errors || err.message;
    return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
  }
}

/**
 * Listează ordine din Shopify.
 * @param {{ limit?: number, status?: string }} opts
 * @returns {{ success: boolean, data?: object[], error?: string }}
 */
async function getOrders({ limit = 10, status = 'any' } = {}) {
  try {
    const url = apiUrl(`/orders.json?limit=${limit}&status=${status}`);
    const { data } = await axios.get(url, { headers: defaultHeaders });
    return { success: true, data: data.orders || [] };
  } catch (err) {
    const msg = err.response?.data?.errors || err.message;
    return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
  }
}

/**
 * Ordine după id Shopify.
 * @param {string|number} id
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
async function getOrderById(id) {
  try {
    const { data } = await axios.get(apiUrl(`/orders/${id}.json`), { headers: defaultHeaders });
    return { success: true, data: data.order };
  } catch (err) {
    const msg = err.response?.data?.errors || err.message;
    return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
  }
}

/**
 * Creează ordine în Shopify.
 * @param {object} orderData
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
async function createOrder(orderData) {
  try {
    const { data } = await axios.post(apiUrl('/orders.json'), { order: orderData }, { headers: defaultHeaders });
    return { success: true, data: data.order };
  } catch (err) {
    const msg = err.response?.data?.errors || err.message;
    return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
  }
}

/**
 * Actualizează ordine în Shopify.
 * @param {string|number} id
 * @param {object} updateData
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
async function updateOrder(id, updateData) {
  try {
    const { data } = await axios.put(apiUrl(`/orders/${id}.json`), { order: updateData }, { headers: defaultHeaders });
    return { success: true, data: data.order };
  } catch (err) {
    const msg = err.response?.data?.errors || err.message;
    return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
  }
}

/**
 * Anulează ordine în Shopify.
 * @param {string|number} id
 * @param {string} reason
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
async function cancelOrder(id, reason = '') {
  try {
    const { data } = await axios.post(apiUrl(`/orders/${id}/cancel.json`), { reason }, { headers: defaultHeaders });
    return { success: true, data: data.order };
  } catch (err) {
    const msg = err.response?.data?.errors || err.message;
    return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
  }
}

/**
 * Adaugă fulfillment cu tracking pentru o ordine Shopify.
 * Mai întâi obține ordinea ca să avem line_items cu id-uri.
 * @param {string|number} orderId - ID Shopify
 * @param {string} trackingNumber
 * @param {string} [trackingUrl]
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
async function addFulfillment(orderId, trackingNumber, trackingUrl = '') {
  try {
    const orderRes = await getOrderById(orderId);
    if (!orderRes.success || !orderRes.data) {
      return { success: false, error: orderRes.error || 'Ordinea nu a fost găsită' };
    }
    const order = orderRes.data;
    const lineItems = (order.line_items || []).map((li) => ({ id: li.id, quantity: li.quantity || 1 }));
    if (lineItems.length === 0) {
      return { success: false, error: 'Ordinea nu are line_items de fulfillment' };
    }

    const body = {
      fulfillment: {
        order_id: order.id,
        line_items: lineItems,
        tracking_number: trackingNumber || undefined,
        tracking_urls: trackingUrl ? [trackingUrl] : undefined
      }
    };

    const { data } = await axios.post(apiUrl('/fulfillments.json'), body, { headers: defaultHeaders });
    return { success: true, data: data.fulfillment };
  } catch (err) {
    const msg = err.response?.data?.errors || err.message;
    return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
  }
}

module.exports = {
  getShopInfo,
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  cancelOrder,
  addFulfillment,
  SHOPIFY_PROXY,
  API_VERSION
};
