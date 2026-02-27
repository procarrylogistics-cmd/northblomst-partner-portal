/**
 * Rute pentru testarea proxy-ului Shopify CLI și alte operațiuni prin proxy.
 */

const express = require('express');
const { getShopInfo, SHOPIFY_PROXY } = require('../utils/shopifyProxy');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { fetchOrderFromShopify, mapOrderDetails } = require('../services/shopifyOrder');
const ShopifyStore = require('../models/ShopifyStore');

const router = express.Router();

// Toate rutele necesită auth + admin
router.use(authMiddleware);
router.use(requireRole('admin'));

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
