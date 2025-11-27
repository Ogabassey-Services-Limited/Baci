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
 * Fetches a merchant's product and reports whether the provided category slug differs from the product's category.
 *
 * Retrieves the merchant by `storeSlug`, then finds the product belonging to that merchant by `productSlug` (matches slug or UUID). If the product has variants, they are loaded and attached to the returned product object. The function also computes `categoryMismatch` when the product has a category and its slug does not match `categorySlug`.
 *
 * @param storeSlug - Merchant/store slug to identify the merchant
 * @param categorySlug - Category slug supplied in the URL (may be empty or different from the product's category)
 * @param productSlug - Product identifier from the URL; may be a slug or a UUID
 * @returns An object `{ product, categoryMismatch }` where `product` is the fetched Product (including `variants` when present) and `categoryMismatch` is `true` if the provided `categorySlug` differs from the product's category slug; returns `null` if the merchant or product could not be found.
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
 * Generate SEO metadata for a product page based on route params and product/merchant data.
 *
 * @param params - Route parameters containing `slug` (merchant store slug), `category` (category slug), and `productSlug` (product slug or id)
 * @returns A Metadata object for the product page. When the product exists this includes title, description, keywords, canonical alternate URL, Open Graph data (title, description, images, url, type, siteName) and Twitter card data; when the product is not found returns minimal metadata with title "Product Not Found" and a descriptive message.
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
 * Render the storefront product detail page for a merchant's category and product.
 *
 * Fetches the product (and merchant) data, triggers a 404 when the product is not found,
 * generates product and breadcrumb JSON-LD, and renders the client-side product detail component.
 *
 * @param params - An object with `slug` (merchant store slug), `category` (category slug), and `productSlug` (product slug or id)
 * @returns The page JSX containing product and breadcrumb `application/ld+json` scripts and the product detail client component
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
            <script
                type="application/ld+json"
                // nosemgrep: react-dangerouslysetinnerhtml
                dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(productSchema) }}
            />
            <script
                type="application/ld+json"
                // nosemgrep: react-dangerouslysetinnerhtml
                dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbSchema) }}
            />
            <ProductDetailClient product={product} />
        </>
    );
}