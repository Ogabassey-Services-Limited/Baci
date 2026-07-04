import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';
import {
  revalidateBlogPosts,
  revalidateCategories,
  revalidateFeatures,
  revalidateMerchant,
  revalidatePageConfig,
  revalidateProducts,
  revalidateReviews,
} from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMerchantBlogRevalidationContext } from '@/lib/get-merchant-blog-cache-identifiers';
import { getMerchantBlogPostCategories } from '@/lib/get-merchant-blog-post-categories';
import { getMerchantBlogPostSlugs } from '@/lib/get-merchant-blog-post-slugs';
import { buildInternalProductPurgeEntries } from '@/lib/internal-product-purge-entries';
import { scheduleStorefrontProductPurge } from '@/lib/storefront-product-purge';
import { internalRevalidateProductEntrySchema } from '@/schemas/internal-revalidate-products-route';

// Past this many products, purge only the shared listing surfaces (home,
// /products, distinct /<category>) to bound the outbound fan-out against
// Cloudflare's per-request URL budget; the short-TTL PDPs self-heal.
const PURGE_LISTINGS_ONLY_THRESHOLD = 50;

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

  const { targets, products } = result.data;

  // Permission gate. Purging shared caches is normally a `settings:edit`
  // (owner/admin) action, but the mobile-admin save/quick-action paths run as
  // staff who may only hold `products:edit` — and after a product write they
  // post a PRODUCTS-ONLY revalidate here to evict the storefront edge cache.
  // Allow `products:edit` (or `settings:edit`) for a products-only request, but
  // keep every other leg (categories/merchant/blog/reviews/features/pages, and
  // the catch-all `all`) locked to `settings:edit` so nothing else is loosened.
  const canManageSettings = hasPermission(access, 'settings', 'edit');
  const isProductsOnlyRequest = targets.every(
    (target) => target === 'products'
  );
  const isAuthorized = isProductsOnlyRequest
    ? canManageSettings || hasPermission(access, 'products', 'edit')
    : canManageSettings;
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const merchantId = access.merchantId;
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
        const { data: merchantRow } = await auth.supabase
          .from('merchants')
          .select('slug')
          .eq('id', merchantId)
          .maybeSingle();
        const merchantSlug = merchantRow?.slug ?? null;
        if (merchantSlug) {
          const purgeEntries = buildInternalProductPurgeEntries(products);
          scheduleStorefrontProductPurge(merchantSlug, purgeEntries, {
            listingsOnly: purgeEntries.length > PURGE_LISTINGS_ONLY_THRESHOLD,
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
