import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Metadata, ResolvingMetadata } from 'next';
import { Suspense } from 'react';
import ProductDetailClient from './product-detail-client';
import { Product } from '@/lib/products';
import { generateProductSchema, generateBreadcrumbSchema, generateAggregateRating, constructCanonicalUrl } from '@/lib/seo-utils';
import { escapeHtml } from '@/lib/sanitize';
import { ProductDetailSkeleton } from '@/components/ui/skeletons';
import { getCachedMerchant, getCachedProduct, getCachedProductRatingStats } from '@/lib/cached-data';

interface PageProps {
    params: Promise<{
        slug: string; // Store slug
        productSlug: string; // Product slug or ID
    }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Get product using cached data functions
 * Falls back to cached product lookup for better performance
 */
async function getProductCached(storeSlug: string, productSlug: string): Promise<Product | null> {
    // Get merchant first to get the merchant ID
    const merchant = await getCachedMerchant(storeSlug);

    if (!merchant) {
        console.error('Merchant not found for slug:', storeSlug);
        return null;
    }

    // Get product using cached function
    const cachedProduct = await getCachedProduct(merchant.id, productSlug);

    if (!cachedProduct) {
        console.error('Product not found:', productSlug);
        return null;
    }

    // Transform cached product to match Product interface
    // Map database fields to Product interface expected fields
    const productImages = cachedProduct.images as Array<{ url: string; alt?: string; order?: number }> | null;
    const firstImage = productImages?.[0]?.url || '';

    const product: Product = {
        id: cachedProduct.id,
        name: cachedProduct.name,
        description: cachedProduct.description || '',
        status: cachedProduct.status as 'draft' | 'active' | 'archived',
        slug: cachedProduct.slug,
        // Map base_price to price
        price: cachedProduct.sale_price || cachedProduct.base_price,
        compare_at_price: cachedProduct.sale_price ? cachedProduct.base_price : undefined,
        // Stock fields
        manage_stock: cachedProduct.track_quantity ?? false,
        stock: cachedProduct.quantity ?? 0,
        // Image fields
        image: firstImage,
        imageLarge: firstImage,
        imageHint: cachedProduct.name,
        images: productImages?.map((img, idx) => ({
            url: img.url,
            alt: img.alt || cachedProduct.name,
            order: img.order ?? idx,
        })),
        // Brand/identifiers (defaults for missing fields)
        brand: '',
        gtin: '',
        mpn: '',
        // Category from nested join (cast through unknown for Supabase type compatibility)
        category: ((cachedProduct.product_categories?.[0]?.categories as unknown) as { id: string; name: string; slug: string } | null)?.name || undefined,
        // Variants
        has_variants: (cachedProduct.product_variants?.length ?? 0) > 0,
        variants: cachedProduct.product_variants?.map(v => ({
            id: v.id,
            product_id: cachedProduct.id,
            merchant_id: merchant.id,
            attributes: v.options || {},
            stock_quantity: v.stock ?? 0,
            price_override: v.price_modifier,
        })) || [],
    };

    return product;
}

export async function generateMetadata(
    { params, searchParams }: PageProps,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { slug, productSlug } = await params;
    const resolvedSearchParams = await searchParams;
    const product = await getProductCached(slug, productSlug);

    if (!product) {
        return {
            title: 'Product Not Found',
            description: 'The product you are looking for does not exist.',
        };
    }

    // Get cached merchant data
    const merchant = await getCachedMerchant(slug);

    const headersList = await headers();
    const host = headersList.get('host') || 'baci.app';
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Construct canonical URL:
    // 1. Use explicit canonical from product data if available
    // 2. OR build the base path and strip noisy params using constructCanonicalUrl
    let canonicalUrl = product.canonical_url;
    
    if (!canonicalUrl) {
        const basePath = `${baseUrl}/products/${product.slug || product.id}`;
        // For product pages, we generally want to strip ALL query params to consolidate authority
        // unless specific params change the content significantly (e.g. variant=123)
        // passing ['variant'] to allowedParams if your variants have unique URLs
        canonicalUrl = constructCanonicalUrl(basePath, resolvedSearchParams, ['variant']); 
    }

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

export default async function ProductPage({ params }: PageProps) {
    const { slug, productSlug } = await params;
    const product = await getProductCached(slug, productSlug);

    if (!product) {
        notFound();
    }

    // Get cached merchant data for schema
    const merchant = await getCachedMerchant(slug);

    // Fetch cached review stats for AggregateRating schema
    const reviewStats = await getCachedProductRatingStats(product.id);

    const headersList = await headers();
    const host = headersList.get('host') || 'baci.app';
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Generate product schema (now handles merging custom schema_markup internally)
    const productSchema = generateProductSchema(
        product,
        merchant?.business_name || 'Baci Store',
        merchant?.payout_currency || 'USD'
    );

    // Add URL to the schema offers (sanitized to prevent XSS)
    if (productSchema.offers) {
        const productUrl = `${baseUrl}/products/${product.slug || product.id}`;
        productSchema.offers.url = escapeHtml(productUrl);
    }

    // Add AggregateRating if reviews exist
    if (reviewStats && reviewStats.totalReviews > 0) {
        const aggregateRating = generateAggregateRating({
            averageRating: reviewStats.averageRating,
            reviewCount: reviewStats.totalReviews
        });
        if (aggregateRating) {
            productSchema.aggregateRating = aggregateRating;
        }
    }

    // Generate breadcrumb schema using helper function (sanitization handled in generateBreadcrumbSchema)
    const productUrl = `${baseUrl}/products/${product.slug || product.id}`;
    const categoryUrl = product.category
        ? `${baseUrl}/products?category=${encodeURIComponent(product.category)}`
        : `${baseUrl}/products`;

    const breadcrumbItems = [
        { name: merchant?.business_name || 'Home', url: baseUrl },
        { name: product.category || 'All Products', url: categoryUrl },
        { name: product.name, url: productUrl }
    ];

    const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);

    return (
        <>
            {/* Product Schema.org JSON-LD */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
            />

            {/* Breadcrumb Schema.org JSON-LD */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
            />

            <Suspense fallback={<ProductDetailSkeleton />}>
                <ProductDetailClient product={product} />
            </Suspense>
        </>
    );
}
