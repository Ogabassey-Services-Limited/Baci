import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CACHE_HEADERS } from '@/lib/cache-headers';
import {
  MerchantNotFoundError,
  resolveFeedMerchant,
} from '@/lib/feed-identifier';
import { createAnonClient } from '@/lib/supabase/anon';
import {
  type FeedProduct,
  generateGoogleMerchantFeed,
  type ImageManifestMap,
} from './feed-builder';
import { FEED_PRODUCTS_SELECT } from './feed-query';
import { buildMerchantBaseUrl } from './route-utils';

const _FeedQuerySchema = z
  .object({
    merchant_id: z.string().uuid().optional(),
    merchant_slug: z.string().min(1).optional(),
  })
  .refine((data) => data.merchant_id || data.merchant_slug, {
    message: 'merchant_id or merchant_slug parameter is required',
  });

/**
 * Cached data fetcher keyed by canonical merchant UUID.
 * Merchant resolution happens outside the cache boundary so that
 * cache tags always use merchant.id (never slugs).
 * Primary domain lookup stays inside the cache — it depends on merchant.id
 * and is cheap to cache alongside products.
 */
function createCachedFeedDataFetcher(merchantId: string, merchantSlug: string) {
  return unstable_cache(
    async () => {
      const supabase = createAnonClient();

      const { data: primaryDomain, error: domainError } = await supabase
        .from('domains')
        .select('domain')
        .eq('merchant_id', merchantId)
        .eq('status', 'active')
        .eq('is_primary', true)
        .maybeSingle();

      if (domainError) {
        console.error('DB_DOMAIN_ERROR:', domainError);
        throw new Error('Failed to fetch merchant domain');
      }

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(FEED_PRODUCTS_SELECT)
        .eq('merchant_id', merchantId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (productsError) {
        console.error('DB_PRODUCTS_ERROR:', productsError);
        throw new Error('Failed to fetch products');
      }

      // Fetch prevalidated image manifest from product_feed_images
      const { data: manifestRows, error: manifestError } = await supabase
        .from('product_feed_images')
        .select(
          'product_id, verified_url, verified_format, status, is_primary, position'
        )
        .eq('merchant_id', merchantId)
        .eq('status', 'verified');

      if (manifestError) {
        console.error('DB_MANIFEST_ERROR:', manifestError);
        throw new Error('Failed to fetch image manifest');
      }

      // Group manifest rows by product_id
      type ManifestRow = {
        product_id: string;
        verified_url: string | null;
        verified_format: string | null;
        status: string;
        is_primary: boolean;
        position: number;
      };

      const imageManifest: ImageManifestMap = {};
      for (const row of (manifestRows || []) as ManifestRow[]) {
        if (!imageManifest[row.product_id]) {
          imageManifest[row.product_id] = [];
        }
        imageManifest[row.product_id].push({
          verified_url: row.verified_url,
          verified_format: row.verified_format,
          status: 'verified' as const,
          is_primary: row.is_primary,
          position: row.position,
        });
      }

      return {
        custom_domain: primaryDomain?.domain ?? null,
        slug: merchantSlug,
        products: (products || []) as FeedProduct[],
        imageManifest,
      };
    },
    ['google-merchant-feed', merchantId],
    {
      revalidate: 3600,
      tags: ['google-merchant-feed', 'products', `merchant-feed-${merchantId}`],
    }
  );
}

/**
 * Google Merchant Center Product Feed API
 *
 * Generates an XML feed compatible with Google Merchant Center.
 * Image URLs are resolved exclusively from the prevalidated
 * `product_feed_images` manifest — zero live network validation.
 *
 * @see https://support.google.com/merchants/answer/7052112
 *
 * Usage: /api/feed/google-merchant?merchant_id=xxx
 * or: /api/feed/google-merchant?merchant_slug=xxx
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawParams = {
    merchant_id: searchParams.get('merchant_id') || undefined,
    merchant_slug: searchParams.get('merchant_slug') || undefined,
  };

  const parsed = _FeedQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || 'Invalid query parameters' },
      { status: 400 }
    );
  }

  const { merchant_id: merchantIdParam, merchant_slug: merchantSlug } =
    parsed.data;

  try {
    // Resolve merchant outside cache so tags use canonical UUID
    const identifier = merchantIdParam || merchantSlug || '';
    const isBySlug = !merchantIdParam && !!merchantSlug;
    const resolvedMerchant = await resolveFeedMerchant(identifier, isBySlug);

    const getCachedFeedData = createCachedFeedDataFetcher(
      resolvedMerchant.id,
      resolvedMerchant.slug
    );
    const { custom_domain, slug, products, imageManifest } =
      await getCachedFeedData();

    const merchant = {
      ...resolvedMerchant,
      custom_domain,
    };

    const baseUrl = buildMerchantBaseUrl({ slug, custom_domain });

    const feedXml = generateGoogleMerchantFeed(
      products,
      merchant,
      baseUrl,
      imageManifest
    );

    return new NextResponse(feedXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        ...CACHE_HEADERS.LONG,
      },
    });
  } catch (error) {
    console.error('FEED_GENERATION_ERROR:', error);
    if (error instanceof MerchantNotFoundError) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to generate feed' },
      { status: 500 }
    );
  }
}
