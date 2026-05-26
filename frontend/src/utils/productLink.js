const STOREFRONT = (import.meta.env.VITE_STOREFRONT_URL || 'https://northblomst.dk').replace(/\/$/, '');

/** Link to product page (saved URL or storefront search by name). */
export function resolveProductLink(product) {
  if (product?.productUrl) return product.productUrl;
  const name = product?.name || '';
  return `${STOREFRONT}/search?q=${encodeURIComponent(name)}`;
}
