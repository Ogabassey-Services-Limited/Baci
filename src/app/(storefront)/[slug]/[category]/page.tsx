import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Suspense } from 'react';

// Template-specific imports
import { OgabasseyLayout } from '@/components/storefront/ogabassey';
import { CategoryPage as OgabasseyCategoryPage } from '@/components/storefront/ogabassey/pages/category-page';
import { ProductGridSkeleton } from '@/components/ui/skeletons';
import type { Product } from '@/lib/products';
import { safeJsonLdStringify } from '@/lib/sanitize-core';
import {
    generateBreadcrumbSchema,
    generateCollectionPageSchema,
    generateFAQSchema,
    generateSlug,
} from '@/lib/seo-utils';
import { createClient } from '@/lib/supabase/server';
import { CATEGORY_SEO_DEFAULTS } from '@/config/category-seo-defaults';

// Enable ISR with 5 minute revalidation
export const revalidate = 300;

interface PageProps {
    params: Promise<{
        slug: string; // Store slug (merchant)
        category: string; // Category slug
    }>;
}

const getCategoryData = cache(async (storeSlug: string, categorySlug: string) => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Get Merchant
    const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('id, business_name, slug, logo_url, template_id, payout_currency')
        .eq('slug', storeSlug)
        .single();

    if (merchantError || !merchant) {
        console.error('Merchant not found:', merchantError);
        return null;
    }

    // 2. Try to find category by slug
    const { data: category } = await supabase
        .from('categories')
        .select('id, name, slug, description, seo_heading, seo_description, seo_features, seo_faq')
        .eq('merchant_id', merchant.id)
        .eq('slug', categorySlug)
        .single();

    // Fallback: decode the slug to get category name
    const categoryName = category?.name || decodeURIComponent(categorySlug).replace(/-/g, ' ');
    const categoryDescription = category?.description || `Browse our collection of ${categoryName} products.`;

    // SEO Content Logic (DB -> Config -> Default)
    const normalizedSlug = categorySlug.toLowerCase();
    const defaultConfig = CATEGORY_SEO_DEFAULTS[normalizedSlug] || null;

    // Check key variations if direct match fails (e.g. 'smartphones' vs 'phones')
    const fallbackConfig = !defaultConfig ?
        Object.entries(CATEGORY_SEO_DEFAULTS).find(([key]) => normalizedSlug.includes(key))?.[1] : null;

    const effectiveConfig = defaultConfig || fallbackConfig;

    const seoContent = {
        heading: category?.seo_heading || effectiveConfig?.heading || `Buy ${categoryName} in Nigeria`,
        description: category?.seo_description || effectiveConfig?.description || categoryDescription,
        features: category?.seo_features || effectiveConfig?.features || [],
        faqs: category?.seo_faq || effectiveConfig?.faqs || [],
    };

    // 3. Get products in this category
    let productsQuery = supabase
        .from('products')
        .select(`
      id,
      name,
      slug,
      description,
      price,
      compare_at_price,
      image,
      images,
      category,
      category_slug,
      brand,
      condition,
      stock,
      rating
    `)
        .eq('merchant_id', merchant.id)
        .eq('status', 'active');

    // Filter by category if we have one
    if (category) {
        // Use category relationship
        productsQuery = productsQuery.eq('category_slug', categorySlug);
    } else {
        // Fallback to string matching on category field
        productsQuery = productsQuery.ilike('category', categoryName.replace(/ /g, '%'));
    }

    const { data: products, error: productsError } = await productsQuery.limit(50);

    if (productsError) {
        console.error('Products query error:', productsError);
    }

    return {
        merchant,
        category: {
            name: categoryName,
            slug: categorySlug,
            description: categoryDescription,
            seo: seoContent,
        },
        products: (products || []) as Product[],
    };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug, category } = await params;
    const data = await getCategoryData(slug, category);

    if (!data) {
        return {
            title: 'Category Not Found',
            description: 'The category you are looking for does not exist.',
        };
    }

    const { merchant, category: categoryData, products } = data;

    const headersList = await headers();
    const host = headersList.get('host') || 'baci.app';
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const categoryUrl = `${baseUrl}/${category}`;

    const title = `${categoryData.name} | ${merchant.business_name}`;
    const description = categoryData.description ||
        `Shop ${categoryData.name} at ${merchant.business_name}. ${products.length} products available.`;

    return {
        title,
        description,
        alternates: {
            canonical: categoryUrl,
        },
        openGraph: {
            title,
            description,
            url: categoryUrl,
            type: 'website',
            siteName: merchant.business_name,
            ...(products.length > 0 && products[0].image && {
                images: [{ url: products[0].image, alt: categoryData.name }],
            }),
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        },
    };
}

export default async function CategoryPageRoute({ params }: PageProps) {
    const { slug, category } = await params;
    const data = await getCategoryData(slug, category);

    if (!data) {
        notFound();
    }

    const { merchant, category: categoryData, products } = data;

    const headersList = await headers();
    const host = headersList.get('host') || 'baci.app';
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const categoryUrl = `${baseUrl}/${category}`;

    // Generate CollectionPage schema
    const collectionSchema = generateCollectionPageSchema({
        name: categoryData.name,
        description: categoryData.description,
        url: categoryUrl,
        products: products,
        merchantName: merchant.business_name,
        currency: merchant.payout_currency || 'NGN',
    });

    // Generate BreadcrumbList schema
    const breadcrumbSchema = generateBreadcrumbSchema([
        { name: merchant.business_name, url: baseUrl },
        { name: categoryData.name, url: categoryUrl },
    ]);

    // Generate FAQPage schema if FAQs exist
    const faqSchema = categoryData.seo.faqs && categoryData.seo.faqs.length > 0
        ? generateFAQSchema(categoryData.seo.faqs)
        : null;

    return (
        <>
            {/* CollectionPage Schema */}
            <script
                type="application/ld+json"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
                dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(collectionSchema) }}
            />
            {/* BreadcrumbList Schema */}
            <script
                type="application/ld+json"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
                dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbSchema) }}
            />
            {/* FAQPage Schema */}
            {faqSchema && (
                <script
                    type="application/ld+json"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
                    dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(faqSchema) }}
                />
            )}

            <Suspense fallback={<ProductGridSkeleton />}>
                <OgabasseyLayout>
                    <OgabasseyCategoryPage
                        seoHeading={categoryData.seo.heading}
                        seoDescription={categoryData.seo.description}
                        seoFeatures={categoryData.seo.features}
                        seoFaqs={categoryData.seo.faqs}
                    />
                </OgabasseyLayout>
            </Suspense>
        </>
    );
}
