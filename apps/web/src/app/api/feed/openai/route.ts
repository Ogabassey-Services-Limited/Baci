import { gzipSync } from 'node:zlib';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRootDomain } from '@/env';
import { CACHE_HEADERS } from '@/lib/cache-headers';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import {
  MerchantNotFoundError,
  resolveFeedMerchant,
} from '@/lib/feed-identifier';
import { getEffectiveStock } from '@/lib/product-stock';
import { stripHtmlTags } from '@/lib/sanitize-core';
import { buildStoreUrl } from '@/lib/store-url';
import { getStorefrontAgentAvailability } from '@/lib/storefront-agent-availability';
import { buildAgentProductUrl } from '@/lib/storefront-agent-urls';
import { RouteIdentifierSchema } from '@/schemas/route-identifier';
import {
  getCachedOpenAIFeedData,
  type OpenAIFeedProduct,
  type OpenAIFeedVariant,
} from './feed-data';

const _FeedQuerySchema = z
  .object({
    merchant_id: z.string().uuid().optional(),
    merchant_slug: z.string().min(1).optional(),
    format: z.enum(['jsonl', 'plain', 'current']).optional(),
  })
  .refine((data) => data.merchant_id || data.merchant_slug, {
    message: 'merchant_id or merchant_slug parameter is required',
  })
  .refine((data) => !(data.merchant_id && data.merchant_slug), {
    message: 'Provide exactly one of merchant_id or merchant_slug, not both',
  });

const UNLIMITED_STOCK_QUANTITY = 9999;
const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();

type VerifiedFeedBaseUrlResult =
  | { success: true; baseUrl: string }
  | { success: false; response: NextResponse };

function getVariantStockCount(
  product: Pick<OpenAIFeedProduct, 'manage_stock'>,
  variant: OpenAIFeedVariant
) {
  if (product.manage_stock === false) {
    // Product-level unmanaged stock is authoritative for the feed. Variant
    // quantities are hidden/zeroed in this mode and there is no variant-level
    // availability override in the product_variants feed contract.
    return UNLIMITED_STOCK_QUANTITY;
  }

  return typeof variant.stock_quantity === 'number'
    ? Math.max(0, variant.stock_quantity)
    : 0;
}

function getRequestHost(request: Request): string {
  const host = request.headers.get('host') || new URL(request.url).host || '';

  return host
    .split(',')[0]
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

function stripPort(host: string): string {
  if (host.startsWith('[')) {
    const closingBracketIndex = host.indexOf(']');
    return closingBracketIndex === -1
      ? host
      : host.slice(0, closingBracketIndex + 1);
  }

  return host.split(':')[0] || '';
}

function isLocalhostIdentifier(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}

function resolveFeedRouteIdentifier(request: Request): string {
  const hostname = stripPort(getRequestHost(request)).replace(/^www\./, '');

  if (!hostname || hostname === ROOT_DOMAIN) {
    return '';
  }

  if (isLocalhostIdentifier(hostname)) {
    return '';
  }

  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    return hostname.slice(0, -(ROOT_DOMAIN.length + 1));
  }

  return hostname;
}

function buildFeedRequestBaseUrl(request: Request): string {
  const requestUrl = new URL(request.url);
  return `${requestUrl.protocol}//${getRequestHost(request)}`;
}

async function resolveVerifiedFeedBaseUrl(
  merchant: Merchant,
  request: Request
): Promise<VerifiedFeedBaseUrlResult> {
  const routeIdentifier = resolveFeedRouteIdentifier(request);

  if (!routeIdentifier) {
    return {
      success: true,
      baseUrl: buildStoreUrl(merchant),
    };
  }

  const parsedRouteIdentifier =
    RouteIdentifierSchema.safeParse(routeIdentifier);

  if (!parsedRouteIdentifier.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid storefront host' },
        { status: 400 }
      ),
    };
  }

  const storefrontMerchant = await getMerchantByIdentifier(
    parsedRouteIdentifier.data
  );

  if (!storefrontMerchant || storefrontMerchant.id !== merchant.id) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Merchant slug does not match storefront host' },
        { status: 400 }
      ),
    };
  }

  return {
    success: true,
    baseUrl: buildFeedRequestBaseUrl(request),
  };
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
  const rawParams = {
    merchant_id: searchParams.get('merchant_id') || undefined,
    merchant_slug: searchParams.get('merchant_slug') || undefined,
    format: searchParams.get('format') || undefined,
  };

  const parsed = _FeedQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || 'Invalid query parameters',
      },
      { status: 400 }
    );
  }

  const {
    merchant_id: merchantIdParam,
    merchant_slug: merchantSlug,
    format,
  } = parsed.data;

  try {
    // Resolve merchant outside cache so tags use canonical UUID
    const identifier = merchantIdParam || merchantSlug || '';
    const isBySlug = !merchantIdParam && !!merchantSlug;
    const merchant = await resolveFeedMerchant(identifier, isBySlug);

    const baseUrlResult = await resolveVerifiedFeedBaseUrl(merchant, request);

    if (!baseUrlResult.success) {
      return baseUrlResult.response;
    }

    const { products } = await getCachedOpenAIFeedData(merchant.id);

    // Generate JSONL feed
    const feedLines =
      format === 'current'
        ? generateCurrentOpenAIProductFeed(
            products,
            merchant,
            baseUrlResult.baseUrl
          )
        : generateOpenAIFeed(products, merchant, baseUrlResult.baseUrl);
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

// --- Interfaces ---

type Product = OpenAIFeedProduct;

interface Merchant {
  id: string;
  business_name: string;
  country?: string;
  custom_domain?: string;
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

interface CurrentOpenAIFeedItem {
  id: string;
  title: string;
  description: {
    plain: string;
  };
  url: string;
  media: Array<{ type: 'image'; url: string }>;
  variants: Array<{
    id: string;
    title: string;
    url: string;
    price: { amount: number; currency: string };
    list_price?: { amount: number; currency: string };
    availability: {
      available: boolean;
      status: 'in_stock' | 'out_of_stock';
      quantity: number | null;
    };
    condition: string[];
    categories: Array<{ value: string; taxonomy: 'merchant' }>;
  }>;
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
    const productUrlBase = buildAgentProductUrl({ baseUrl, product });

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

        const stockCount = getVariantStockCount(product, variant);
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

      // manage_stock === false means unlimited stock (no inventory tracking)
      let stockCount: number;
      let availability: OpenAIFeedItem['availability'];
      if (product.manage_stock === false) {
        stockCount = UNLIMITED_STOCK_QUANTITY;
        availability = 'in_stock';
      } else {
        stockCount = getEffectiveStock(product);
        availability = stockCount > 0 ? 'in_stock' : 'out_of_stock';
      }

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

function getOpenAIFeedImageUrl(product: Product): string {
  const firstImage = product.images?.[0];
  return typeof firstImage === 'string' ? firstImage : firstImage?.url || '';
}

function getCurrentFeedCategoryValue(product: Product): string {
  return product.category || product.google_product_category || 'Products';
}

function buildCurrentFeedVariantTitle(
  product: Product,
  variant: OpenAIFeedVariant
): string {
  const titleParts = [product.name];
  const color = variant.attributes?.color || variant.attributes?.Color;
  const size = variant.attributes?.size || variant.attributes?.Size;
  const storage = variant.attributes?.storage || variant.attributes?.Storage;

  if (color) titleParts.push(color);
  if (size) titleParts.push(size);
  if (storage) titleParts.push(storage);

  return titleParts.join(' - ');
}

function buildCurrentFeedVariants(
  product: Product,
  url: string,
  currency: string,
  productAvailability: ReturnType<typeof getStorefrontAgentAvailability>
): CurrentOpenAIFeedItem['variants'] {
  if (!product.variants?.length) {
    return [
      {
        id: product.sku || product.id,
        title: product.name,
        url,
        price: { amount: product.price, currency },
        list_price:
          product.compare_at_price && product.compare_at_price > product.price
            ? { amount: product.compare_at_price, currency }
            : undefined,
        availability: {
          available: productAvailability.is_purchasable,
          status: productAvailability.availability,
          quantity: productAvailability.quantity_available,
        },
        condition: [product.condition || 'new'],
        categories: [
          {
            value: getCurrentFeedCategoryValue(product),
            taxonomy: 'merchant',
          },
        ],
      },
    ];
  }

  return product.variants.flatMap((variant) => {
    const price = variant.price_override ?? product.price;
    if (price <= 0) {
      return [];
    }

    const availability = getStorefrontAgentAvailability({
      manage_stock: product.manage_stock,
      stock_quantity: variant.stock_quantity,
    });

    return [
      {
        id: variant.sku || variant.id,
        title: buildCurrentFeedVariantTitle(product, variant),
        url,
        price: { amount: price, currency },
        list_price:
          product.compare_at_price && product.compare_at_price > price
            ? { amount: product.compare_at_price, currency }
            : undefined,
        availability: {
          available: availability.is_purchasable,
          status: availability.availability,
          quantity: availability.quantity_available,
        },
        condition: [product.condition || 'new'],
        categories: [
          {
            value: getCurrentFeedCategoryValue(product),
            taxonomy: 'merchant',
          },
        ],
      },
    ];
  });
}

function hasCurrentFeedOffer(product: Product): boolean {
  if (product.variants?.length) {
    return product.variants.some(
      (variant) => (variant.price_override ?? product.price) > 0
    );
  }

  return product.price > 0;
}

function generateCurrentOpenAIProductFeed(
  products: Product[],
  merchant: Merchant,
  baseUrl: string
): string[] {
  const currency = merchant.payout_currency || 'NGN';

  return products
    .filter((product) => {
      if (!product.name || product.name.trim().length === 0) {
        return false;
      }

      return hasCurrentFeedOffer(product);
    })
    .map((product) => {
      const url = buildAgentProductUrl({ baseUrl, product });
      const availability = getStorefrontAgentAvailability({
        manage_stock: product.manage_stock,
        stock: product.stock,
        stock_quantity: product.stock_quantity,
      });
      const imageUrl = getOpenAIFeedImageUrl(product);

      const item: CurrentOpenAIFeedItem = {
        id: product.id,
        title: product.name,
        description: {
          plain: stripHtmlTags(product.description || '')
            .trim()
            .slice(0, 5000),
        },
        url,
        media: imageUrl ? [{ type: 'image', url: imageUrl }] : [],
        variants: buildCurrentFeedVariants(
          product,
          url,
          currency,
          availability
        ),
      };

      return JSON.stringify(item);
    });
}
