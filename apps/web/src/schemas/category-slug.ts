import { MAX_CATEGORY_SLUG_LENGTH } from '@baci/shared';
import { z } from 'zod';
import { normalizePostHogProxyPath } from '@/lib/posthog/config';
import { STOREFRONT_SPECIAL_COLLECTION_SLUGS } from '@/lib/storefront-special-collection-slugs';

const postHogRelayFirstSegment = normalizePostHogProxyPath(
  process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH
)
  .split('/')
  .find(Boolean);

/**
 * Storefront first-path segments a category slug must never take.
 *
 * A category slug becomes `/{slug}` on the storefront, but the App Router's
 * STATIC routes win over the dynamic category route — so a category slugged
 * `cart` is unreachable at its own advertised URL while its navigation links
 * silently point at the cart. Rejecting at write time is the only place this
 * can be caught cheaply.
 *
 * Kept in sync with valid slug-shaped entries in
 * `RESERVED_STOREFRONT_SEGMENTS` and `MAIN_APP_ROUTES` in `proxy.ts` (which are
 * middleware-internal), including the default PostHog relay path. The C0
 * design gate proposes a generated artifact both files would import; until
 * that lands this list is duplicated deliberately and its test pins the
 * platform collisions.
 */
export const RESERVED_CATEGORY_SLUGS = new Set<string>([
  ...STOREFRONT_SPECIAL_COLLECTION_SLUGS,
  ...(postHogRelayFirstSegment ? [postHogRelayFirstSegment] : []),
  'about',
  'account',
  'api',
  'auth',
  'baci-relay',
  'blog',
  'builder',
  'cart',
  'category',
  'checkout',
  'compare',
  'contact',
  'dashboard',
  'delete-account',
  'faq',
  'forgot-password',
  'imei-check',
  'member-status',
  'login',
  'my-account',
  'order-success',
  'onboarding',
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
  'reset-password',
  'returns',
  'reviews',
  'search',
  'shipping',
  'signup',
  'sitemap',
  'staff',
  'storefront',
  'swap',
  'terms',
  'terms-and-conditions',
  'terms-of-service',
  'track-order',
  'unlock-orders',
  'update-password',
  'verify',
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
