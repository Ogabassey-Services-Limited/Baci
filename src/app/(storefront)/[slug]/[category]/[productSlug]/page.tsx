import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import ProductDetailClient from '../../products/[productSlug]/product-detail-client';
import { Product } from '@/lib/products';
import { generateProductSchema, generateBreadcrumbSchema, generateSlug, getProductUrl } from '@/lib/seo-utils';
import { escapeHtml, sanitizeSchemaMarkup, safeJsonLdStringify } from '@/lib/sanitize';

// Enable ISR with 5 minute revalidation
export const revalidate = 300;

interface PageProps {
    params: Promise<{
        slug: string;        // Store slug (merchant)
        category: string;    // Category slug
        productSlug: string; // Product slug
    }>;
}

/**
 * Retrieve a product for a merchant using the store slug, supplied category slug, and a product identifier.
 *
 * @param storeSlug - The merchant's store slug
 * @param categorySlug - The category slug from the URL (used to detect mismatches)
 * @param productSlug - The product slug or UUID used to locate the product
 * @returns An object containing `product` and `categoryMismatch` when found; `null` if the merchant or product cannot be found. `categoryMismatch` is `true` when the product's actual category slug differs from `categorySlug`.
 */
async function getProduct(storeSlug: string, categorySlug: string, productSlug: string) {
    const supabase = createServerComponentClient({ cookies });

    // 1. Get Merchant ID from store slug
    const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('id, business_name')
        .eq('slug', storeSlug)
        .single();

    if (merchantError || !merchant) {
        console.error('Merchant not found:', merchantError);
        return null;
    }

    // 2. Get Product by slug and merchant_id
    // Also verify category matches (for SEO canonical purposes)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productSlug);

    let query = supabase
        .from('products')
        .select('*')
        .eq('merchant_id', merchant.id);

    if (isUuid) {
        query = query.or(`slug.eq.${productSlug},id.eq.${productSlug}`);
    } else {
        query = query.eq('slug', productSlug);
    }

    const { data: product, error: productError } = await query.single();

    if (productError || !product) {
        console.error('Product not found:', productError);
        return null;
    }

    // Verify category matches (optional - for strictness)
    // If category doesn't match, we could redirect to the correct URL
    // For now, we'll just serve the product but use the correct canonical URL
    const productCategorySlug = product.category ? generateSlug(product.category) : null;
    const categoryMismatch = productCategorySlug && productCategorySlug !== categorySlug;

    // Fetch variants if needed
    if (product.has_variants) {
        const { data: variants } = await supabase
            .from('product_variants')
            .select('*')
            .eq('product_id', product.id);

        if (variants) {
            product.variants = variants;
        }
    }

    return { product: product as Product, categoryMismatch };
}

/**
 * Builds SEO metadata for a storefront product page using the provided route parameters and fetched product and merchant data.
 *
 * Fetches the product (by slug or id) and merchant information, constructs canonical and Open Graph data, and includes Twitter card fields and keywords. If the product is not found, returns minimal metadata indicating the product was not found.
 *
 * @param params - PageProps containing a promise that resolves to route parameters: `slug` (store/merchant), `category` (category slug), and `productSlug` (product slug or id)
 * @returns A Metadata object with title, description, keywords, alternates.canonical, openGraph, and twitter fields populated for the product (or minimal not-found metadata when no product is available)
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug, category, productSlug } = await params;
    const result = await getProduct(slug, category, productSlug);

    if (!result?.product) {
        return {
            title: 'Product Not Found',
            description: 'The product you are looking for does not exist.',
        };
    }

    const { product } = result;
    const supabase = createServerComponentClient({ cookies });

    const { data: merchant } = await supabase
        .from('merchants')
        .select('business_name, social_media')
        .eq('slug', slug)
        .single();

    const headersList = await headers();
    const host = headersList.get('host') || 'baci.app';
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Build canonical URL using the proper category-based format
    const canonicalPath = getProductUrl(product);
    const canonicalUrl = product.canonical_url || `${baseUrl}${canonicalPath}`;

    const socialMedia = merchant?.social_media as Record<string, string> | undefined;

    return {
        title: product.meta_title || `${product.name} | ${merchant?.business_name || 'Baci Store'}`,
        description: product.meta_description || product.description,
        keywords: product.keywords,
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            title: product.meta_title || product.name,
            description: product.meta_description || product.description,
            images: product.images?.map(img => ({ url: img.url, alt: img.alt })) || [
                {
                    url: product.imageLarge || product.image,
                    width: 800,
                    height: 600,
                    alt: product.name,
                },
            ],
            url: canonicalUrl,
            type: 'website',
            siteName: merchant?.business_name,
        },
        twitter: {
            card: 'summary_large_image',
            title: product.meta_title || product.name,
            description: product.meta_description || product.description,
            images: [product.imageLarge || product.image],
            ...(socialMedia?.twitter && {
                site: socialMedia.twitter.startsWith('@') ? socialMedia.twitter : `@${socialMedia.twitter}`,
                creator: socialMedia.twitter.startsWith('@') ? socialMedia.twitter : `@${socialMedia.twitter}`,
            }),
        },
    };
}

/**
 * Render the product detail page for a store, including product JSON-LD, breadcrumb JSON-LD, and the client-side product detail component.
 *
 * Calls notFound() to trigger a 404 when the requested product or merchant cannot be resolved.
 *
 * @param params - An object containing `slug` (store/merchant slug), `category` (category slug), and `productSlug` (product slug or UUID)
 * @returns The React element for the product detail page
 */
export default async function CategoryProductPage({ params }: PageProps) {
    const { slug, category, productSlug } = await params;
    const result = await getProduct(slug, category, productSlug);

    if (!result?.product) {
        notFound();
    }

    const { product } = result;
    const supabase = createServerComponentClient({ cookies });

    const { data: merchant } = await supabase
        .from('merchants')
        .select('business_name, payout_currency, category')
        .eq('slug', slug)
        .single();

    const headersList = await headers();
    const host = headersList.get('host') || 'baci.app';
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Generate product schema
    const productSchema = product.schema_markup
        ? sanitizeSchemaMarkup(product.schema_markup)
        : generateProductSchema(
            product,
            merchant?.business_name || 'Baci Store',
            merchant?.payout_currency || 'USD'
        );

    // Build proper URL for schema
    const productPath = getProductUrl(product);
    const productUrl = `${baseUrl}${productPath}`;

    if (productSchema.offers) {
        productSchema.offers.url = escapeHtml(productUrl);
    }

    // Generate breadcrumb schema with category
    const categoryUrl = product.category
        ? `${baseUrl}/${generateSlug(product.category)}`
        : `${baseUrl}/products`;

    const breadcrumbItems = [
        { name: merchant?.business_name || 'Home', url: baseUrl },
        { name: product.category || 'All Products', url: categoryUrl },
        { name: product.name, url: productUrl }
    ];

    const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);

    return (
        <>
            {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml - JSON-LD is sanitized and not executed */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(productSchema) }}
            />
            {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml - JSON-LD is sanitized and not executed */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbSchema) }}
            />
            <ProductDetailClient product={product} />
        </>
    );
}