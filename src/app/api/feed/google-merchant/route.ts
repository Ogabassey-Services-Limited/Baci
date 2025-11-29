import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripHtmlTags } from '@/lib/sanitize';
import { CACHE_HEADERS } from '@/lib/cache-headers';
import { unstable_cache } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Factory function that creates a cached fetcher for each merchant
// This ensures each merchant gets their own cache entry
function createCachedFeedDataFetcher(merchantIdentifier: string, isBySlug: boolean) {
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

            const { data: products, error: productsError } = await supabase
                .from('products')
                .select('*')
                .eq('merchant_id', merchant.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (productsError) {
                throw new Error('Failed to fetch products');
            }

            return { merchant, products: products || [] };
        },
        ['google-merchant-feed', merchantIdentifier], // Include merchant identifier in cache key
        {
            revalidate: 3600, // Revalidate every 1 hour
            tags: ['google-merchant-feed', 'products', `merchant-feed-${merchantIdentifier}`],
        }
    );
}

/**
 * Google Merchant Center Product Feed API
 *
 * Generates an XML feed compatible with Google Merchant Center
 * @see https://support.google.com/merchants/answer/7052112
 *
 * Usage: /api/feed/google-merchant?merchant_id=xxx
 * or: /api/feed/google-merchant?merchant_slug=xxx
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

    try {
        const identifier = merchantId || merchantSlug!;
        const getCachedFeedData = createCachedFeedDataFetcher(identifier, !!merchantSlug);
        const { merchant, products } = await getCachedFeedData();

        // Determine base URL from request headers
        const host = request.headers.get('host') || `${merchant.slug}.baci.app`;
        const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        // Generate RSS 2.0 feed with Google Merchant Center extensions
        const feedXml = generateGoogleMerchantFeed(products, merchant, baseUrl);

        return new NextResponse(feedXml, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                ...CACHE_HEADERS.LONG, // Cache for 1 hour with stale-while-revalidate
            },
        });
    } catch (error) {
        const message = (error as Error).message;
        if (message === 'Merchant not found') {
            return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to generate feed' }, { status: 500 });
    }
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
    weight_value?: number;
    weight_unit?: 'kg' | 'lb' | 'g' | 'oz';
    updated_at?: string;
}

interface Merchant {
    id: string;
    business_name: string;
    country?: string;
    payout_currency?: string;
    slug: string;
}

function generateGoogleMerchantFeed(products: Product[], merchant: Merchant, baseUrl: string): string {
    const currency = merchant.payout_currency || 'USD';
    const brandName = merchant.business_name;

    const items = products.map((product) => {
        const productUrl = `${baseUrl}/products/${product.slug || product.id}`;
        const imageUrl = product.images?.[0]?.url || product.imageLarge || product.image || '';

        // Additional images (max 10 additional images as per Google requirements)
        const additionalImages = product.images
            ?.slice(1, 11)
            .map(img => `        <g:additional_image_link>${escapeXml(img.url)}</g:additional_image_link>`)
            .join('\n') || '';

        // Availability
        const availability = product.stock > 0 ? 'in_stock' : 'out_of_stock';

        // Condition
        const condition = product.condition || 'new';

        // Sale price (if compare_at_price exists and is higher than current price)
        const salePrice = product.compare_at_price && product.compare_at_price > product.price
            ? `        <g:sale_price>${product.price} ${currency}</g:sale_price>\n        <g:price>${product.compare_at_price} ${currency}</g:price>`
            : `        <g:price>${product.price} ${currency}</g:price>`;

        // Shipping weight
        const shippingWeight = product.weight_value && product.weight_unit
            ? `        <g:shipping_weight>${product.weight_value} ${product.weight_unit}</g:shipping_weight>`
            : '';

        return `    <item>
        <g:id>${escapeXml(product.id)}</g:id>
        <g:title>${escapeXml(product.name)}</g:title>
        <g:description>${escapeXml(stripHtmlTags(product.description).trim())}</g:description>
        <g:link>${escapeXml(productUrl)}</g:link>
        <g:image_link>${escapeXml(imageUrl)}</g:image_link>
${additionalImages}
        <g:availability>${availability}</g:availability>
${salePrice}
        <g:brand>${escapeXml(product.brand || brandName)}</g:brand>
        <g:condition>${condition}</g:condition>
${product.gtin ? `        <g:gtin>${escapeXml(product.gtin)}</g:gtin>` : ''}
${product.mpn ? `        <g:mpn>${escapeXml(product.mpn)}</g:mpn>` : ''}
${product.sku ? `        <g:identifier_exists>yes</g:identifier_exists>` : '        <g:identifier_exists>no</g:identifier_exists>'}
${product.google_product_category ? `        <g:google_product_category>${escapeXml(product.google_product_category)}</g:google_product_category>` : ''}
${product.category ? `        <g:product_type>${escapeXml(product.category)}</g:product_type>` : ''}
${shippingWeight}
    </item>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(brandName)} - Product Feed</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Product feed for ${escapeXml(brandName)}</description>
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

