import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { CACHE_HEADERS } from '@/lib/cache-headers';
import {
  type FeedProduct,
  generateGoogleMerchantFeed,
  type ImageManifestMap,
} from './feed-builder';
import { buildMerchantBaseUrl } from './route-utils';

/**
 * Module-level anon-key client is intentional: this is a public feed endpoint
 * hit by Google's crawler — no auth cookies exist. Using `@/lib/supabase/server`
 * (which reads cookies) would be incorrect here.
 */
const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());

const _FeedQuerySchema = z
  .object({
    merchant_id: z.string().uuid().optional(),
    merchant_slug: z.string().min(1).optional(),
  })
  .refine((data) => data.merchant_id || data.merchant_slug, {
    message: 'merchant_id or merchant_slug parameter is required',
  });

function createCachedFeedDataFetcher(
  merchantIdentifier: string,
  isBySlug: boolean
) {
  return unstable_cache(
    async () => {
      const merchantQuery = supabase
        .from('merchants')
        .select('id, business_name, country, payout_currency, slug');

      const { data: merchant, error: merchantError } = isBySlug
        ? await merchantQuery.eq('slug', merchantIdentifier).single()
        : await merchantQuery.eq('id', merchantIdentifier).single();

      if (merchantError || !merchant) {
        throw new Error('Merchant not found');
      }

      const { data: primaryDomain, error: domainError } = await supabase
        .from('domains')
        .select('domain')
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .eq('is_primary', true)
        .maybeSingle();

      if (domainError) {
        console.error('DB_DOMAIN_ERROR:', domainError);
        throw new Error('Failed to fetch merchant domain');
      }

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(
          `id, name, description, slug, price, compare_at_price,
           brand, gtin, mpn, sku, stock, condition, google_product_category, category,
           weight_value, weight_unit, updated_at`
        )
        .eq('merchant_id', merchant.id)
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
        .eq('merchant_id', merchant.id)
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
          status: 'verified' as const, // Query filters .eq('status', 'verified')
          is_primary: row.is_primary,
          position: row.position,
        });
      }

      return {
        merchant: {
          ...merchant,
          custom_domain: primaryDomain?.domain ?? null,
        },
        products: (products || []) as FeedProduct[],
        imageManifest,
      };
    },
    ['google-merchant-feed', isBySlug ? 'slug' : 'id', merchantIdentifier],
    {
      revalidate: 3600,
      tags: [
        'google-merchant-feed',
        'products',
        `merchant-feed-${merchantIdentifier}`,
      ],
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

  const { merchant_id: merchantId, merchant_slug: merchantSlug } = parsed.data;

  try {
    const identifier = merchantId || merchantSlug || '';
    const getCachedFeedData = createCachedFeedDataFetcher(
      identifier,
      !!merchantSlug
    );
    const { merchant, products, imageManifest } = await getCachedFeedData();

    const baseUrl = buildMerchantBaseUrl(merchant);

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
    const message = (error as Error).message;
    if (message === 'Merchant not found') {
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
