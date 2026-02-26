/**
 * Rute pentru testarea proxy-ului Shopify CLI și alte operațiuni prin proxy.
 */

const express = require('express');
const { getShopInfo, SHOPIFY_PROXY } = require('../utils/shopifyProxy');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// Toate rutele necesită auth + admin
router.use(authMiddleware);
router.use(requireRole('admin'));

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
