import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
  type UserAccess,
} from '@/lib/api-auth';
import { enrichProductPurgeEntries } from '@/lib/authoritative-product-purge-enrichment';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';
import {
  revalidateBlogPosts,
  revalidateCategories,
  revalidateFeatures,
  revalidateMerchant,
  revalidatePageConfig,
  revalidateProductSlugs,
  revalidateProducts,
  revalidateReviews,
} from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMerchantBlogRevalidationContext } from '@/lib/get-merchant-blog-cache-identifiers';
import { getMerchantBlogPostCategories } from '@/lib/get-merchant-blog-post-categories';
import { getMerchantBlogPostSlugs } from '@/lib/get-merchant-blog-post-slugs';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { scheduleStorefrontProductPurge } from '@/lib/storefront-product-purge';
import {
  countDistinctProductPurgeEntries,
  PURGE_LISTINGS_ONLY_THRESHOLD,
} from '@/lib/storefront-product-purge-urls';
import { internalRevalidateProductEntrySchema } from '@/schemas/internal-revalidate-products-route';

/**
 * Cache Revalidation API
 *
 * POST /api/cache/revalidate
 * Allows authenticated merchants to manually purge cached data for their store.
 * Useful after bulk imports, external data changes, or debugging stale data.
 */

const revalidateSchema = z.object({
  // Which entity types to revalidate
  targets: z
    .array(
      z.enum([
        'products',
        'categories',
        'merchant',
        'blog',
        'reviews',
        'features',
        'pages',
        'all',
      ])
    )
    .min(1, 'At least one target is required'),
  // Optional: specific products whose public storefront URLs should also be
  // evicted from Cloudflare (in addition to the Next tag revalidation). Used by
  // the mobile-admin save path, which mutates products via the Supabase RPC
  // (no web route runs, so no purge fires) — after a save it posts the saved
  // product's slug/category here. Only honored when the `products` target (or
  // `all`) is requested.
  products: z.array(internalRevalidateProductEntrySchema).max(1000).optional(),
  // Optional: the ACTIVE merchant whose product was just mutated. Mobile-admin
  // sends this so a staff user belonging to MULTIPLE merchants purges the RIGHT
  // storefront: without it the route falls back to the caller's DEFAULT access
  // (`get_user_access`), which may resolve a different merchant than the one
  // that owns the saved product. When present and different from the default
  // merchant, the route VERIFIES the caller actually has access to it (owner or
  // active staff) before using it — an unverified id is a hard 403, never a
  // silent fall-back.
  merchantId: z.string().trim().min(1).max(255).optional(),
});

export async function POST(request: NextRequest) {
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid && response) return response;

  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const access = await getUserAccess(auth.supabase);
  if (!access) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  const body = await request.json();
  const result = revalidateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Invalid input',
        code: 'INVALID_INPUT',
        details: z.flattenError(result.error),
      },
      { status: 400 }
    );
  }

  const { targets, products, merchantId: requestedMerchantId } = result.data;

  // Resolve the merchant this request acts on. `get_user_access` returns the
  // caller's DEFAULT merchant — for a user who owns/staffs MULTIPLE merchants
  // that may NOT be the merchant whose product the mobile app just saved. When
  // the client names a specific merchant, re-resolve access SCOPED to that
  // merchant (owner or active-staff membership, with that merchant's own
  // permissions) so BOTH the permission gate below and the server-side slug
  // lookup run against the RIGHT merchant. NEVER trust the client id without
  // this verification: a foreign/unknown id resolves to no membership and is a
  // hard 403 — we do not silently fall back to the default merchant.
  let effectiveAccess: UserAccess = access;
  if (requestedMerchantId && requestedMerchantId !== access.merchantId) {
    const scopedContext = await getMerchantForApiRequest(
      auth.supabase,
      auth.user.id,
      { requestedMerchantId }
    );
    if (!scopedContext) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    effectiveAccess = toUserAccess(scopedContext);
  }

  // Permission gate. Purging shared caches is normally a `settings:edit`
  // (owner/admin) action, but the mobile-admin save/quick-action paths run as
  // staff who may only hold `products:edit` — and after a product write they
  // post a PRODUCTS-ONLY revalidate here to evict the storefront edge cache.
  // Allow `products:edit` (or `settings:edit`) for a products-only request, but
  // keep every other leg (categories/merchant/blog/reviews/features/pages, and
  // the catch-all `all`) locked to `settings:edit` so nothing else is loosened.
  const canManageSettings = hasPermission(effectiveAccess, 'settings', 'edit');
  const isProductsOnlyRequest = targets.every(
    (target) => target === 'products'
  );
  // `products:create`-only staff (mobile create flow) must also be able to
  // evict the storefront edge cache for the product they just created.
  const isAuthorized = isProductsOnlyRequest
    ? canManageSettings ||
      hasPermission(effectiveAccess, 'products', 'edit') ||
      hasPermission(effectiveAccess, 'products', 'create')
    : canManageSettings;
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const merchantId = effectiveAccess.merchantId;
  const failedTargets: string[] = [];
  const revalidated: string[] = [];

  const shouldRevalidate = (target: string) =>
    targets.includes('all') || targets.includes(target as (typeof targets)[0]);

  if (shouldRevalidate('products')) {
    revalidateProducts(merchantId);
    revalidated.push('products');

    // Also evict the affected products' public URLs from Cloudflare when the
    // caller supplies them. The merchant slug is resolved server-side from the
    // authenticated merchant (never trusted from the client), so a caller can
    // only purge its own storefront. Fire-and-forget: a purge is always
    // survivable, so it never fails the revalidation.
    if (products && products.length > 0) {
      try {
        // Resolve authoritative purge entries (real slug/category URLs for
        // {id}-only or join-categorized products, plus old-category moves) from
        // the product ROWS via the shared enrichment used by the internal route
        // too, and bust the per-slug Next product-detail caches for every
        // resolved slug. This only needs `merchantId` — NOT the merchant's
        // Cloudflare-facing slug below — so it must run for EVERY
        // products-carrying request, independent of whether that slug lookup
        // succeeds. Fail-open lives inside enrichProductPurgeEntries: any lookup
        // problem falls back to the caller's flat hints.
        const { entries, resolvedSlugs } = await enrichProductPurgeEntries(
          auth.supabase,
          merchantId,
          products
        );
        // Bust the per-slug Next product-detail caches for every resolved slug
        // BEFORE scheduling the edge purge below: without this, a Cloudflare
        // MISS after the purge refills the edge from the still-tagged Next
        // entry (the PDP snapshot is tagged per-slug, unaffected by the
        // slug-less revalidateProducts above) until its cacheLife TTL,
        // defeating it.
        revalidateProductSlugs(merchantId, resolvedSlugs);

        // The Cloudflare edge purge additionally needs the merchant's public
        // storefront slug (to build the hostnames to purge) — resolve it here
        // and gate ONLY `scheduleStorefrontProductPurge` on it. A failed/missing
        // lookup must never skip the Next-layer busting above.
        const { data: merchantRow, error: merchantLookupError } =
          await auth.supabase
            .from('merchants')
            .select('slug')
            .eq('id', merchantId)
            .maybeSingle();
        if (merchantLookupError) {
          // Fail-open: log for observability but continue with whatever data
          // came back — a stale storefront cache self-heals on its TTL, so a
          // failed purge must never fail the revalidation.
          console.error(
            'Failed to resolve merchant slug for Cloudflare product purge (continuing with available data):',
            { merchantId, error: merchantLookupError }
          );
        }
        const merchantSlug = merchantRow?.slug ?? null;
        if (merchantSlug) {
          // Base the fan-out threshold on the DISTINCT (slug, segment) count so
          // duplicate entries for one product do not inflate the count and
          // wrongly suppress its per-PDP purge. Counts the old-category entries
          // too so a move that adds a distinct old target is reflected here.
          const distinctPurgeCount = countDistinctProductPurgeEntries(entries);
          scheduleStorefrontProductPurge(merchantSlug, entries, {
            listingsOnly: distinctPurgeCount > PURGE_LISTINGS_ONLY_THRESHOLD,
          });
        }
      } catch (purgeError) {
        console.error('Skipped Cloudflare product purge in cache/revalidate:', {
          merchantId,
          purgeError,
        });
      }
    }
  }

  if (shouldRevalidate('categories')) {
    revalidateCategories(merchantId);
    revalidated.push('categories');
  }

  if (shouldRevalidate('merchant')) {
    revalidateMerchant(merchantId);
    revalidated.push('merchant');
  }

  if (shouldRevalidate('blog')) {
    try {
      const [blogRevalidation, postSlugs, listingCategories] =
        await Promise.all([
          getMerchantBlogRevalidationContext(auth.supabase, merchantId),
          getMerchantBlogPostSlugs(auth.supabase, merchantId),
          getMerchantBlogPostCategories(auth.supabase, merchantId),
        ]);
      const listingPages = Array.from(
        {
          length: Math.max(
            1,
            Math.ceil(postSlugs.length / BLOG_LISTING_PAGE_SIZE)
          ),
        },
        (_, index) => index + 1
      );

      revalidateBlogPosts({
        identifiers: blogRevalidation.identifiers,
        canonicalMerchantSlug: blogRevalidation.canonicalMerchantSlug,
        listingCategories,
        listingPages,
        postSlugs,
      });
      revalidated.push('blog');
    } catch (error) {
      console.error('Failed to revalidate blog caches:', {
        merchantId,
        error,
      });
      failedTargets.push('blog');
    }
  }

  if (shouldRevalidate('reviews')) {
    revalidateReviews(merchantId);
    revalidated.push('reviews');
  }

  if (shouldRevalidate('features')) {
    revalidateFeatures(merchantId);
    revalidated.push('features');
  }

  if (shouldRevalidate('pages')) {
    revalidatePageConfig(merchantId);
    revalidated.push('pages');
  }

  const success = failedTargets.length === 0;

  if (!success) {
    return NextResponse.json(
      {
        error: `Cache purge failed for: ${failedTargets.join(', ')}`,
        failedTargets,
        revalidated,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      revalidated,
      failedTargets: [],
      message: `Cache purged for: ${revalidated.join(', ')}`,
    },
    { status: 200 }
  );
}
