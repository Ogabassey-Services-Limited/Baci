import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { CACHE_HEADERS } from '@/lib/cache-headers';
import {
  type FeedProduct,
  type FeedVariant,
  generateGoogleMerchantFeed,
  type ImageManifestMap,
} from './feed-builder';
import { buildMerchantBaseUrl } from './route-utils';
import type { FeedKeySpecs } from './variant-mapping';

type VariantRow = {
  id: string;
  product_id: string;
  sku?: string;
  attributes: Record<string, string>;
  price_override?: number;
  stock_quantity: number;
};

type SpecsRow = {
  product_id: string;
  ram_gb?: number;
  storage_gb?: number;
  screen_size_inches?: number;
  chipset?: string;
  battery_mah?: number;
  main_camera_mp?: number;
};

const PRODUCT_KEY_SPECS_SELECT =
  'product_id, ram_gb, storage_gb, screen_size_inches, chipset, battery_mah, main_camera_mp';
const PRODUCT_KEY_SPECS_CHUNK_SIZE = 200;

/**
 * Module-level anon-key client is intentional: this is a public feed endpoint
 * hit by Google's crawler — no auth cookies exist. Using `@/lib/supabase/server`
 * (which reads cookies) would be incorrect here.
 */
const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());

async function fetchProductKeySpecs(productIds: string[]): Promise<SpecsRow[]> {
  const specsChunks: string[][] = [];
  for (
    let index = 0;
    index < productIds.length;
    index += PRODUCT_KEY_SPECS_CHUNK_SIZE
  ) {
    specsChunks.push(
      productIds.slice(index, index + PRODUCT_KEY_SPECS_CHUNK_SIZE)
    );
  }

  const specsResults = await Promise.all(
    specsChunks.map((chunk) =>
      supabase
        .from('product_key_specs')
        .select(PRODUCT_KEY_SPECS_SELECT)
        .in('product_id', chunk)
    )
  );
  const specsError = specsResults.find((result) => result.error);
  if (specsError?.error) {
    console.error('DB_SPECS_ERROR:', specsError.error);
    throw new Error('Failed to fetch product key specs');
  }

  return specsResults.flatMap((result) => result.data || []);
}

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
        .select(
          'id, business_name, country, payout_currency, slug, gmc_variants_enabled'
        );

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
           brand, gtin, mpn, sku, stock, manage_stock, stock_quantity, condition, google_product_category, category,
           categories:category_id(name, slug),
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

      const gmcVariantsEnabled = merchant.gmc_variants_enabled === true;
      const productIds = (products || []).map((p: { id: string }) => p.id);

      let variantRows: VariantRow[] = [];
      let specsRows: SpecsRow[] = [];

      if (productIds.length > 0) {
        const variantPromise = gmcVariantsEnabled
          ? supabase.rpc('get_storefront_product_variants', {
              p_product_ids: productIds,
            })
          : Promise.resolve({ data: [] as VariantRow[], error: null });
        const [variantResult, fetchedSpecsRows] = await Promise.all([
          variantPromise,
          fetchProductKeySpecs(productIds),
        ]);

        if (variantResult.error) {
          console.error('DB_VARIANT_ERROR:', variantResult.error);
          throw new Error('Failed to fetch product variants');
        }

        variantRows = variantResult.data || [];
        specsRows = fetchedSpecsRows;
      }

      // Group variants by product_id
      const variantsByProduct: Record<string, FeedVariant[]> = {};
      for (const row of variantRows) {
        if (!variantsByProduct[row.product_id]) {
          variantsByProduct[row.product_id] = [];
        }
        variantsByProduct[row.product_id].push({
          id: row.id,
          sku: row.sku,
          attributes: row.attributes || {},
          price_override: row.price_override ?? undefined,
          stock_quantity: row.stock_quantity ?? 0,
        });
      }

      // Index key_specs by product_id
      const specsByProduct: Record<string, FeedKeySpecs> = {};
      for (const row of specsRows) {
        specsByProduct[row.product_id] = {
          ram_gb: row.ram_gb ?? undefined,
          storage_gb: row.storage_gb ?? undefined,
          screen_size_inches: row.screen_size_inches ?? undefined,
          chipset: row.chipset ?? undefined,
          battery_mah: row.battery_mah ?? undefined,
          main_camera_mp: row.main_camera_mp ?? undefined,
        };
      }

      // Merge variants and specs onto products
      const enrichedProducts: FeedProduct[] = (products || []).map((p) => ({
        ...(p as unknown as FeedProduct),
        variants:
          variantsByProduct[(p as Record<string, unknown>).id as string],
        key_specs: specsByProduct[(p as Record<string, unknown>).id as string],
      }));

      return {
        merchant: {
          ...merchant,
          custom_domain: primaryDomain?.domain ?? null,
        },
        products: enrichedProducts,
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
