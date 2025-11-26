import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * TikTok Shopping Product Feed API
 *
 * Generates an XML feed compatible with TikTok Shop
 * @see https://ads.tiktok.com/help/article/product-catalog-feed-spec
 *
 * Usage: /api/feed/tiktok?merchant_id=xxx
 * or: /api/feed/tiktok?merchant_slug=xxx
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
        : await merchantQuery.eq('slug', merchantSlug!).single();

    if (merchantError || !merchant) {
        return NextResponse.json(
            { error: 'Merchant not found' },
            { status: 404 }
        );
    }

    // Get active products with all necessary fields
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

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

    // Generate TikTok catalog feed
    const feedXml = generateTikTokFeed(products || [], merchant, baseUrl);

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
    condition?: 'new' | 'used' | 'refurbished';
    google_product_category?: string;
    category?: string;
}

interface Merchant {
    id: string;
    business_name: string;
    country?: string;
    payout_currency?: string;
    slug: string;
}

function generateTikTokFeed(products: Product[], merchant: Merchant, baseUrl: string): string {
    const currency = merchant.payout_currency || 'USD';
    const brandName = merchant.business_name;

    const items = products.map((product) => {
        const productUrl = `${baseUrl}/products/${product.slug || product.id}`;
        const imageUrl = product.images?.[0]?.url || product.imageLarge || product.image || '';

        // Additional images (TikTok supports multiple)
        const additionalImages = product.images
            ?.slice(1, 10)
            .map(img => `        <additional_image_link>${escapeXml(img.url)}</additional_image_link>`)
            .join('\n') || '';

        // Availability - TikTok uses 'in_stock' / 'out_of_stock'
        const availability = product.stock > 0 ? 'in_stock' : 'out_of_stock';

        // Condition
        const condition = product.condition || 'new';

        // Sale price
        const salePrice = product.compare_at_price && product.compare_at_price > product.price
            ? `        <sale_price>${product.price} ${currency}</sale_price>\n        <price>${product.compare_at_price} ${currency}</price>`
            : `        <price>${product.price} ${currency}</price>`;

        // TikTok requires SKU or ID
        const itemGroupId = product.sku || product.id;

        return `    <item>
        <id>${escapeXml(product.id)}</id>
        <item_group_id>${escapeXml(itemGroupId)}</item_group_id>
        <title>${escapeXml(product.name)}</title>
        <description>${escapeXml(stripHtml(product.description))}</description>
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
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(brandName)} - TikTok Catalog</title>
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
    return unsafe.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Strip HTML tags from description
 */
function stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
}
