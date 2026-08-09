const API_SOURCE_ROOT = 'apps/web/src/app/api/';

const STOREFRONT_API_SOURCE_PATHS = new Set([
  'ai/grade-device',
  'attr',
  'blog/exit-preview',
  'blog/feed/[merchantSlug]',
  'blog/preview',
  'cart/validate',
  'chat/santa',
  'chat/santa/product',
  'csrf',
  'events',
  'forms/submit',
  'newsletter/subscribe',
  'ogabassey/pdp-lcp-image/[productSlug]',
  'ogabassey/pdp-lcp-image/profile/[profile]/[productSlug]',
  'orders/update-payment-ref',
  'orders/[id]',
  'payments/initialize',
  'payments/status',
  'payments/verify',
  'products/count',
  'quiz/leaderboard',
  'reviews',
  'reviews/[id]/helpful',
  'search',
  'search/autocomplete',
  'shipping/quotes',
  'wishlist',
  'wishlist/check',
]);

/** Limits edge-origin API inventory to reviewed customer storefront routes. */
export function isStorefrontRequiredApiSourcePath(sourcePath: string): boolean {
  if (
    !sourcePath.startsWith(API_SOURCE_ROOT) ||
    !sourcePath.endsWith('/route.ts')
  )
    return false;
  const relativePath = sourcePath
    .slice(API_SOURCE_ROOT.length)
    .replace(/\/route\.ts$/, '');
  return (
    relativePath.startsWith('storefront/') ||
    STOREFRONT_API_SOURCE_PATHS.has(relativePath)
  );
}
