import { gzipSync } from 'node:zlib';
import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { CACHE_HEADERS } from '@/lib/cache-headers';
import { getEffectiveStock } from '@/lib/product-stock';
import { stripHtmlTags } from '@/lib/sanitize-core';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Factory function that creates a cached fetcher for each merchant
function createCachedFeedDataFetcher(
  merchantIdentifier: string,
  isBySlug: boolean
) {
  return unstable_cache(
    async () => {
      const merchantQuery = supabase
        .from('merchants')
        .select('id, business_name, country, payout_currency, slug, logo_url');

      const { data: merchant, error: merchantError } = isBySlug
        ? await merchantQuery.eq('slug', merchantIdentifier).single()
        : await merchantQuery.eq('id', merchantIdentifier).single();

      if (merchantError || !merchant) {
        throw new Error('Merchant not found');
      }

      // Fetch products with variants for OpenAI spec (Best Practice: Include all sellable units)
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(
          `id, name, description, slug, price, compare_at_price, images,
           brand, gtin, mpn, sku, stock, stock_quantity, condition, google_product_category, category,
           weight_value, weight_unit, updated_at,
           variants:product_variants(id, attributes, price_override, stock_quantity, sku, primary_image)`
        )
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (productsError) {
        console.error('DB_PRODUCTS_ERROR:', productsError);
        throw new Error('Failed to fetch products');
      }

      return { merchant, products: products || [] };
    },
    ['openai-product-feed', merchantIdentifier],
    {
      revalidate: 3600, // Revalidate every 1 hour
      tags: [
        'openai-product-feed',
        'products',
        `merchant-feed-${merchantIdentifier}`,
      ],
    }
  );
}

/**
 * OpenAI Product Feed API
 *
 * Generates a JSONL feed compatible with OpenAI's Product Feed Spec
 * @see https://developers.openai.com/commerce/specs/feed
 *
 * Usage: /api/feed/openai?merchant_id=xxx
 * or: /api/feed/openai?merchant_slug=xxx
 * or: /api/feed/openai?merchant_slug=xxx&format=jsonl (gzipped)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const merchantId = searchParams.get('merchant_id');
  const merchantSlug = searchParams.get('merchant_slug');
  const format = searchParams.get('format'); // 'jsonl' for gzipped, default is plain

  if (!merchantId && !merchantSlug) {
    return NextResponse.json(
      { error: 'merchant_id or merchant_slug parameter is required' },
      { status: 400 }
    );
  }

  try {
    const identifier = merchantId || merchantSlug || '';
    const getCachedFeedData = createCachedFeedDataFetcher(
      identifier,
      !!merchantSlug
    );
    const { merchant, products } = await getCachedFeedData();

    // Determine base URL from request headers
    const host = request.headers.get('host') || `${merchant.slug}.baci.app`;
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Generate JSONL feed
    const feedLines = generateOpenAIFeed(products, merchant, baseUrl);
    const feedContent = feedLines.join('\n');

    // Return gzipped if format=jsonl requested
    if (format === 'jsonl') {
      const gzipped = gzipSync(Buffer.from(feedContent, 'utf-8'));
      return new NextResponse(gzipped, {
        status: 200,
        headers: {
          'Content-Type': 'application/gzip',
          'Content-Disposition': `attachment; filename="${merchant.slug}-openai-feed.jsonl.gz"`,
          'Content-Encoding': 'gzip',
          ...CACHE_HEADERS.LONG,
        },
      });
    }

    // Default: return plain JSONL for debugging/preview
    return new NextResponse(feedContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        ...CACHE_HEADERS.LONG,
      },
    });
  } catch (error) {
    console.error('OPENAI_FEED_GENERATION_ERROR:', error);
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

// --- Interfaces ---

interface Variant {
  id: string;
  attributes: Record<string, string>; // e.g., { color: 'Red', size: 'XL' }
  price_override?: number;
  stock_quantity?: number;
  sku?: string;
  primary_image?: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  slug?: string;
  price: number;
  compare_at_price?: number;
  images?: string[] | Array<{ url: string; alt?: string }>;
  brand?: string;
  gtin?: string;
  mpn?: string;
  sku?: string;
  stock: number;
  condition?: 'new' | 'used' | 'refurbished';
  google_product_category?: string;
  category?: string;
  weight_value?: number;
  weight_unit?: 'kg' | 'lb' | 'g' | 'oz';
  updated_at?: string;
  variants?: Variant[];
}

interface Merchant {
  id: string;
  business_name: string;
  country?: string;
  payout_currency?: string;
  slug: string;
  logo_url?: string;
}

// --- OpenAI Feed Item Structure ---

interface OpenAIFeedItem {
  // OpenAI Flags
  enable_search: boolean;
  enable_checkout: boolean;

  // Basic Product Data
  id: string;
  gtin?: string;
  mpn?: string;
  title: string;
  description: string;
  link: string;

  // Item Information
  condition: 'new' | 'used' | 'refurbished';
  product_type?: string;
  brand?: string;

  // Media
  image_link: string;
  additional_image_links?: string[];

  // Price & Promotions
  price: string; // Format: "79.99 USD"
  sale_price?: string;

  // Availability & Inventory
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
  quantity?: number;

  // Variants
  item_group_id?: string;
  color?: string;
  size?: string;

  // Fulfillment
  shipping_weight?: string;

  // Merchant Info
  merchant_name: string;
  merchant_url: string;
  privacy_policy_url?: string;
  terms_of_service_url?: string;

  // Returns
  return_policy_url?: string;
  return_days?: number;

  // Performance Signals
  rating?: number;
}

/**
 * Generate OpenAI-compatible JSONL feed
 */
function generateOpenAIFeed(
  products: Product[],
  merchant: Merchant,
  baseUrl: string
): string[] {
  const currency = merchant.payout_currency || 'NGN';
  const feedItems: string[] = [];

  // Filter out invalid products (kept parent validation just in case)
  const validProducts = products.filter((p) => p.name && p.name.trim() !== '');

  for (const product of validProducts) {
    const productUrlBase = `${baseUrl}/${merchant.slug}/${product.category?.toLowerCase() || 'products'}/${product.slug || product.id}`;

    // Determine whether to use variants or the parent product
    const hasVariants = product.variants && product.variants.length > 0;

    if (hasVariants) {
      // --- VARIANT MODE: Generate item for each variant ---
      // biome-ignore lint/style/noNonNullAssertion: Checked hasVariants above
      for (const variant of product.variants!) {
        // Skip variants with no price if we can't fall back (though we usually fall back to parent)
        const finalPrice = variant.price_override || product.price;
        if (finalPrice <= 0) continue;

        // Image: Variant Primary -> Parent First Image -> Empty
        const variantImage = variant.primary_image;
        const parentFirstImageRaw = product.images?.[0];
        const parentFirstImage =
          typeof parentFirstImageRaw === 'string'
            ? parentFirstImageRaw
            : parentFirstImageRaw?.url || '';

        const imageUrl = variantImage || parentFirstImage;

        // Stock: Variant Stock
        // NOTE: api/products uses 'stock_quantity' for variants
        const stockCount =
          typeof variant.stock_quantity === 'number'
            ? variant.stock_quantity
            : 0;
        const availability: OpenAIFeedItem['availability'] =
          stockCount > 0 ? 'in_stock' : 'out_of_stock';

        // Format Price
        const formattedPrice = `${finalPrice.toFixed(2)} ${currency}`;

        // Attributes
        const color =
          variant.attributes?.color || variant.attributes?.Color || undefined;
        const size =
          variant.attributes?.size || variant.attributes?.Size || undefined;

        // Title - Enhance with crucial attributes if present to differentiate
        // E.g. "iPhone 13 Pro - Red - 128GB"
        const variantTitleParts = [product.name];
        if (color) variantTitleParts.push(color);
        if (variant.attributes?.storage)
          variantTitleParts.push(variant.attributes.storage);
        const variantTitle = variantTitleParts.join(' - ');

        const feedItem: OpenAIFeedItem = {
          enable_search: true,
          enable_checkout: true,

          id: variant.sku || variant.id, // Use SKU for variant if possible
          item_group_id: product.id, // CRITICAL: Groups variants together

          gtin: product.gtin || undefined, // Often shared, sometimes distinct
          mpn: product.mpn || undefined,
          title: variantTitle,
          description: stripHtmlTags(product.description || '')
            .trim()
            .slice(0, 5000),
          link: productUrlBase, // Ideally deep link: `${productUrlBase}?variant=${variant.id}`, but base is fine

          condition: product.condition || 'new',
          product_type: product.category || product.google_product_category,
          brand: product.brand || merchant.business_name,

          image_link: imageUrl,
          // Additional images from parent are usually relevant
          additional_image_links: product.images
            ?.slice(1, 11)
            .map((img) => (typeof img === 'string' ? img : img.url))
            .filter(Boolean) as string[],

          price: formattedPrice,
          // Sale price logic for variants is complex; skip for now or implement if data available

          availability,
          quantity: stockCount,

          color,
          size,

          merchant_name: merchant.business_name,
          merchant_url: `${baseUrl}/${merchant.slug}`,
          privacy_policy_url: `${baseUrl}/privacy`,
          terms_of_service_url: `${baseUrl}/terms`,
          return_policy_url: `${baseUrl}/pages/returns`,
          return_days: 7,
        };

        // Clean and push
        const cleanItem = Object.fromEntries(
          Object.entries(feedItem).filter(([, v]) => v !== undefined)
        );
        feedItems.push(JSON.stringify(cleanItem));
      }
    } else {
      // --- SIMPLE PRODUCT MODE: Standard single item ---
      if (product.price <= 0) continue;

      const firstImage = product.images?.[0];
      const imageUrl =
        typeof firstImage === 'string' ? firstImage : firstImage?.url || '';

      const stockCount = getEffectiveStock(product);
      const availability: OpenAIFeedItem['availability'] =
        stockCount > 0 ? 'in_stock' : 'out_of_stock';

      const formattedPrice = `${product.price.toFixed(2)} ${currency}`;
      const salePrice =
        product.compare_at_price && product.compare_at_price > product.price
          ? formattedPrice
          : undefined;
      const regularPrice =
        product.compare_at_price && product.compare_at_price > product.price
          ? `${product.compare_at_price.toFixed(2)} ${currency}`
          : formattedPrice;

      const shippingWeight =
        product.weight_value && product.weight_unit
          ? `${product.weight_value} ${product.weight_unit}`
          : undefined;

      const feedItem: OpenAIFeedItem = {
        enable_search: true,
        enable_checkout: true,
        id: product.sku || product.id,
        gtin: product.gtin || undefined,
        mpn: product.mpn || undefined,
        title: product.name,
        description: stripHtmlTags(product.description || '')
          .trim()
          .slice(0, 5000),
        link: productUrlBase,
        condition: product.condition || 'new',
        product_type: product.category || product.google_product_category,
        brand: product.brand || merchant.business_name,
        image_link: imageUrl,
        additional_image_links: product.images
          ?.slice(1, 11)
          .map((img) => (typeof img === 'string' ? img : img.url))
          .filter(Boolean) as string[],
        price: regularPrice,
        sale_price: salePrice,
        availability,
        quantity: stockCount,
        shipping_weight: shippingWeight,
        merchant_name: merchant.business_name,
        merchant_url: `${baseUrl}/${merchant.slug}`,
        privacy_policy_url: `${baseUrl}/privacy`,
        terms_of_service_url: `${baseUrl}/terms`,
        return_policy_url: `${baseUrl}/pages/returns`,
        return_days: 7,
      };

      const cleanItem = Object.fromEntries(
        Object.entries(feedItem).filter(([, v]) => v !== undefined)
      );
      feedItems.push(JSON.stringify(cleanItem));
    }
  }

  return feedItems;
}
