import { MAX_CATEGORY_SLUG_LENGTH } from '@baci/shared';
import { z } from 'zod';

/**
 * Storefront first-path segments a category slug must never take.
 *
 * A category slug becomes `/{slug}` on the storefront, but the App Router's
 * STATIC routes win over the dynamic category route — so a category slugged
 * `cart` is unreachable at its own advertised URL while its navigation links
 * silently point at the cart. Rejecting at write time is the only place this
 * can be caught cheaply.
 *
 * Kept in sync with `RESERVED_STOREFRONT_SEGMENTS` in `proxy.ts` (which is not
 * exported — it is middleware-internal). The C0 design gate (docs/architecture/
 * c0-route-classification-feasibility.md) proposes a generated artifact both
 * files would import; until that lands this list is duplicated deliberately,
 * and the colocated test pins the overlap so drift is visible.
 */
export const RESERVED_CATEGORY_SLUGS = new Set<string>([
  'about',
  'account',
  'api',
  'blog',
  'cart',
  'category',
  'checkout',
  'compare',
  'contact',
  'delete-account',
  'faq',
  'imei-check',
  'member-status',
  'my-account',
  'order-success',
  'pages',
  'privacy',
  'privacy-policy',
  'product',
  'product-category',
  'products',
  'quiz',
  'receipts',
  'repair',
  'repairs',
  'returns',
  'reviews',
  'search',
  'shipping',
  'sitemap',
  'storefront',
  'swap',
  'terms',
  'terms-and-conditions',
  'terms-of-service',
  'track-order',
  'unlock-orders',
  'wallet',
  'warranty',
  'wishlist',
]);

/** Storefront-safe slug: lowercase alphanumeric words separated by single dashes. */
export const categorySlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CATEGORY_SLUG_LENGTH)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase alphanumeric words separated by single dashes'
  )
  .refine((slug) => !RESERVED_CATEGORY_SLUGS.has(slug), {
    message: 'That slug is reserved by a storefront route',
  });
