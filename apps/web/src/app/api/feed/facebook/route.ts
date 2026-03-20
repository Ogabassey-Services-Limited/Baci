import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { stripHtmlTags } from '@/lib/sanitize-core';
import { getEffectiveProductStock } from '@/lib/seo-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Facebook & Instagram Product Catalog Feed API
 *
 * Generates an XML feed compatible with Facebook Commerce and Instagram Shopping
 * @see https://developers.facebook.com/docs/marketing-api/catalog/guides/product-feed
 *
 * Usage: /api/feed/facebook?merchant_id=xxx
 * or: /api/feed/facebook?merchant_slug=xxx
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const merchantId = searchParams.get('merchant_id');
  const merchantSlug = searchParams.get('merchant_slug');

  if (!merchantId && !merchantSlug) {
    return NextResponse.json(
      { error: 'merchant_id or merchant_slug parameter is required' },
      { status: 400 }
    );
  }

  // Get merchant data
  const merchantQuery = supabase
    .from('merchants')
    .select('id, business_name, country, payout_currency, slug');

  const { data: merchant, error: merchantError } = merchantId
    ? await merchantQuery.eq('id', merchantId).single()
    : await merchantQuery.eq('slug', merchantSlug ?? '').single();

  if (merchantError || !merchant) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  // PERFORMANCE: Select only required fields and add limit to prevent OOM
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(
      `id, name, description, slug, price, compare_at_price, images, image, imageLarge,
       brand, gtin, mpn, sku, stock, stock_quantity, condition, google_product_category, category`
    )
    .eq('merchant_id', merchant.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10000);

  if (productsError) {
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }

  // Determine base URL from request headers
  const host = request.headers.get('host') || `${merchant.slug}.baci.app`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // Generate Facebook catalog feed
  const feedXml = generateFacebookFeed(products || [], merchant, baseUrl);

  return new NextResponse(feedXml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
    },
  });
}

interface Product {
  id: string;
  name: string;
  description: string;
  slug?: string;
  price: number;
  compare_at_price?: number;
  images?: Array<{ url: string; alt?: string }>;
  image?: string;
  imageLarge?: string;
  brand?: string;
  gtin?: string;
  mpn?: string;
  sku?: string;
  stock: number;
  stock_quantity?: number | null;
  condition?: 'new' | 'used' | 'refurbished';
  google_product_category?: string;
  category?: string;
  weight_value?: number;
  weight_unit?: 'kg' | 'lb' | 'g' | 'oz';
}

interface Merchant {
  id: string;
  business_name: string;
  country?: string;
  payout_currency?: string;
  slug: string;
}

function generateFacebookFeed(
  products: Product[],
  merchant: Merchant,
  baseUrl: string
): string {
  const currency = merchant.payout_currency || 'USD';
  const brandName = merchant.business_name;

  const items = products
    .map((product) => {
      const productUrl = `${baseUrl}/products/${product.slug || product.id}`;
      const imageUrl =
        product.images?.[0]?.url || product.imageLarge || product.image || '';

      // Additional images (Facebook supports up to 20)
      const additionalImages =
        product.images
          ?.slice(1, 20)
          .map(
            (img) =>
              `        <additional_image_link>${escapeXml(img.url)}</additional_image_link>`
          )
          .join('\n') || '';

      // Availability - Facebook uses different values than Google
      const availability = getEffectiveProductStock(product)
        ? 'in stock'
        : 'out of stock';

      // Condition
      const condition = product.condition || 'new';

      // Sale price (if compare_at_price exists and is higher than current price)
      const salePrice =
        product.compare_at_price && product.compare_at_price > product.price
          ? `        <sale_price>${product.price} ${currency}</sale_price>\n        <price>${product.compare_at_price} ${currency}</price>`
          : `        <price>${product.price} ${currency}</price>`;

      return `    <item>
        <id>${escapeXml(product.id)}</id>
        <title>${escapeXml(truncate(product.name, 150))}</title>
        <description>${escapeXml(truncate(stripHtmlTags(product.description).trim(), 5000))}</description>
        <availability>${availability}</availability>
${salePrice}
        <link>${escapeXml(productUrl)}</link>
        <image_link>${escapeXml(imageUrl)}</image_link>
${additionalImages}
        <brand>${escapeXml(product.brand || brandName)}</brand>
        <condition>${condition}</condition>
${product.gtin ? `        <gtin>${escapeXml(product.gtin)}</gtin>` : ''}
${product.mpn ? `        <mpn>${escapeXml(product.mpn)}</mpn>` : ''}
${product.category ? `        <product_type>${escapeXml(product.category)}</product_type>` : ''}
${product.google_product_category ? `        <google_product_category>${escapeXml(product.google_product_category)}</google_product_category>` : ''}
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(brandName)} - Product Catalog</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Product catalog for ${escapeXml(brandName)}</description>
${items}
  </channel>
</rss>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Truncate text to specified length
 */
function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}
