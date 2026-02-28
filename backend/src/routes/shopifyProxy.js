/**
 * Rute pentru testarea proxy-ului Shopify CLI și alte operațiuni prin proxy.
 */

const express = require('express');
const axios = require('axios');
const { getShopInfo, SHOPIFY_PROXY } = require('../utils/shopifyProxy');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { fetchOrderFromShopify, mapOrderDetails } = require('../services/shopifyOrder');
const ShopifyStore = require('../models/ShopifyStore');

const router = express.Router();

// Toate rutele necesită auth + admin
router.use(authMiddleware);
router.use(requireRole('admin'));

/**
 * GET /api/shopify/status
 * Returns Shopify connection status. Used by Admin to show reconnect banner.
 */
router.get('/status', async (req, res) => {
  try {
    const store = await ShopifyStore.findOne().sort({ installedAt: -1 });
    if (!store?.accessToken || !store?.shop) {
      return res.json({
        shop: store?.shop || '',
        connected: false,
        reason: 'TOKEN_INVALID'
      });
    }
    await axios.get(
      `https://${store.shop}/admin/oauth/access_scopes.json`,
      { headers: { 'X-Shopify-Access-Token': store.accessToken } }
    );
    const baseUrl = (process.env.SHOPIFY_APP_URL || '').trim().replace(/\/$/, '');
    return res.json({
      shop: store.shop,
      connected: true,
      reconnectUrl: `${baseUrl}/auth/shopify?shop=${store.shop}`
    });
  } catch (err) {
    const store = await ShopifyStore.findOne().sort({ installedAt: -1 });
    const shop = store?.shop || process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_SHOP || '';
    const baseUrl = (process.env.SHOPIFY_APP_URL || '').trim().replace(/\/$/, '');
    return res.json({
      shop: shop || '',
      connected: false,
      reason: 'TOKEN_INVALID',
      reconnectUrl: shop ? `${baseUrl}/auth/shopify?shop=${shop}` : null
    });
  }
});

/**
 * GET /api/shopify/scopes
 * Returns Shopify OAuth access scopes. Confirms read_products is present.
 * If read_products is missing, returns message that reinstall is required.
 */
router.get('/scopes', async (req, res) => {
  try {
    const store = await ShopifyStore.findOne().sort({ installedAt: -1 });
    if (!store?.accessToken || !store?.shop) {
      return res.json({
        success: false,
        error: 'No Shopify store connected. Run OAuth first.',
        scopes: []
      });
    }
    const { data } = await axios.get(
      `https://${store.shop}/admin/oauth/access_scopes.json`,
      { headers: { 'X-Shopify-Access-Token': store.accessToken } }
    );
    const scopes = data?.access_scopes || [];
    const scopeNames = Array.isArray(scopes) ? scopes.map((s) => (s && s.handle) ? s.handle : String(s)).filter(Boolean) : [];
    const hasReadProducts = scopeNames.includes('read_products');
    return res.json({
      success: true,
      scopes: scopeNames,
      hasReadProducts,
      message: hasReadProducts
        ? 'read_products scope present.'
        : 'read_products scope MISSING. Add it in Shopify Partner Dashboard → App → Settings → API scopes, release new version, then reinstall the app.'
    });
  } catch (err) {
    const msg = err.response?.data?.errors || err.message;
    return res.status(502).json({
      success: false,
      error: typeof msg === 'string' ? msg : JSON.stringify(msg),
      scopes: []
    });
  }
});

/**
 * GET /api/shopify/order/:orderId?shop=
 * Returnează detaliile comenzii din Shopify (live) folosind tokenul din Mongo.
 */
router.get('/order/:orderId', async (req, res) => {
  const orderId = req.params.orderId;
  let shop = (req.query.shop || '').trim();
  if (!shop) {
    const store = await ShopifyStore.findOne().sort({ installedAt: -1 });
    shop = store?.shop || '';
  }
  if (!shop) {
    return res.status(400).json({ error: 'No shop. Provide ?shop= or connect a store first.' });
  }
  const result = await fetchOrderFromShopify(shop, orderId);
  if (!result.success) {
    return res.status(404).json({ error: result.error || 'Order not found' });
  }
  const details = mapOrderDetails(result.data);
  res.json({ order: result.data, orderDetails: details });
});

/**
 * GET /api/shopify/test-proxy
 * Verifică dacă proxy-ul Shopify CLI răspunde.
 */
router.get('/test-proxy', async (req, res) => {
  const result = await getShopInfo();
  if (result.success) {
    return res.json({
      success: true,
      shopName: result.data?.name || 'N/A',
      proxyUrl: SHOPIFY_PROXY
    });
  }
  const errMsg = result.error || 'Eroare necunoscută';
  const isConnectionError = /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|fetch failed/i.test(errMsg);
  const message = isConnectionError
    ? `Proxy-ul nu răspunde la ${SHOPIFY_PROXY}. ` +
      'Shopify CLI nu rulează sau portul s-a schimbat. ' +
      'Pornește: cd profitable-vertical-app && shopify app dev --store=northblomst-dev.myshopify.com --use-localhost --localhost-port=3456. ' +
      'Apoi în .env: SHOPIFY_PROXY_URL=http://localhost:3456. Restart backend.'
    : errMsg;
  res.status(502).json({ success: false, message, proxyUrl: SHOPIFY_PROXY });
});

module.exports = router;
