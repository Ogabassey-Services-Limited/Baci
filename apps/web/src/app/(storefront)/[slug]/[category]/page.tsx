import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache, Suspense } from 'react';

import { CategoryPage as OgabasseyCategoryPage } from '@/components/storefront/ogabassey/pages/category-page';
import type { V2ThemeMode } from '@/components/storefront/ogabassey/providers/v2-theme-context';
import { ProductGridSkeleton } from '@/components/ui/skeletons';
import { CATEGORY_SEO_DEFAULTS } from '@/config/category-seo-defaults';
import {
  getCachedCategories,
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { normalizeProduct, type RawDbProduct } from '@/lib/normalize-product';
import type { Product } from '@/lib/products';
import { safeJsonLdStringify } from '@/lib/sanitize-core';
import {
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
  generateFAQSchema,
} from '@/lib/seo-utils';
import { createClient } from '@/lib/supabase/server';
import { isDomainIdentifier } from '@/lib/validation';

// Enable ISR with 5 minute revalidation
export const revalidate = 300;

/**
 * Generate static params for category pages at build time.
 * This pre-renders category pages for faster initial loads and better SEO.
 * Koray's framework: Zero server round-trips for crawlers = optimal Cost of Retrieval.
 *
 * Note: If SUPABASE_SERVICE_ROLE_KEY is unavailable at build time (e.g., in CI),
 * we gracefully fallback to an empty array, deferring to runtime SSR with ISR.
 */
export async function generateStaticParams() {
  try {
    // Check if service role key is available before attempting database queries
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log(
        '[generateStaticParams] SUPABASE_SERVICE_ROLE_KEY unavailable at build time, skipping static generation'
      );
      return [];
    }

    // For now, generate params for OgaBassey store (primary storefront)
    const merchant = await getCachedMerchant('ogabassey');
    if (!merchant) return [];

    const categories = await getCachedCategories(merchant.id);

    // Generate params for each category
    return categories.map((category) => ({
      slug: 'ogabassey',
      category: category.slug,
    }));
  } catch (error) {
    // Gracefully handle errors during static generation (e.g., missing env vars)
    console.warn(
      '[generateStaticParams] Error during static generation, falling back to runtime SSR:',
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

interface PageProps {
  params: Promise<{
    slug: string; // Store slug (merchant)
    category: string; // Category slug
  }>;
}

const getCategoryData = cache(
  async (storeSlug: string, categorySlug: string) => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Get Merchant (using cached function for consistency and robust 404 handling)
    const merchant = isDomainIdentifier(storeSlug)
      ? await getCachedMerchantByDomain(storeSlug)
      : await getCachedMerchant(storeSlug);

    if (!merchant) {
      // Expected for invalid URLs (e.g., /smartphones/iphone instead of /ogabassey/smartphones/iphone)
      // Not an error - notFound() will handle this gracefully
      return null;
    }

    // 2. Special Collection Handling (Smart Collections)
    const SPECIAL_COLLECTIONS = [
      'new-arrivals',
      'best-sellers',
      'on-sale',
      'featured',
    ];

    if (SPECIAL_COLLECTIONS.includes(categorySlug)) {
      let query = supabase
        .from('products')
        .select('*') // Select all fields to match RawDbProduct structure
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .limit(50);

      let collectionName = 'Collection';
      let collectionDesc = 'Browse our collection.';

      // Apply specific logic based on collection type
      switch (categorySlug) {
        case 'new-arrivals':
          collectionName = 'New Arrivals';
          collectionDesc = 'Check out the latest additions to our store.';
          query = query.order('created_at', { ascending: false });
          break;
        case 'best-sellers':
          collectionName = 'Best Sellers';
          collectionDesc = 'Our most popular products loved by customers.';
          // robust fallback: sort by rating desc
          query = query.order('rating', { ascending: false });
          break;
        case 'on-sale':
          collectionName = 'On Sale';
          collectionDesc = 'Great deals and discounts on top products.';
          // Filter for products with a compare_at_price set
          query = query.not('compare_at_price', 'is', null);
          break;
        case 'featured':
          collectionName = 'Featured';
          collectionDesc = 'Hand-picked highlights just for you.';
          // For now, sort by price desc as a proxy for "premium/featured"
          query = query.order('price', { ascending: false });
          break;
      }

      const { data: productsData, error: productsError } = await query;

      if (productsError) {
        console.error('Smart Collection Error:', productsError);
      }

      const products = (productsData || []) as unknown as Product[];

      return {
        merchant,
        category: {
          name: collectionName,
          slug: categorySlug,
          description: collectionDesc,
          image: null,
          seo: {
            heading: collectionName,
            description: collectionDesc,
            features: [],
            faqs: [],
          },
          parent: null,
        },
        products,
      };
    }

    // 3. Try to find category by slug (fetching parent for hierarchical SEO)
    const { data: category } = await supabase
      .from('categories')
      .select(
        'id, name, slug, description, image_url, seo_heading, seo_description, seo_features, seo_faq, parent:parent_id(name, slug)'
      )
      .eq('merchant_id', merchant.id)
      .eq('slug', categorySlug)
      .single();

    // Fallback: decode the slug to get category name and Title Case it
    const categoryName =
      category?.name ||
      decodeURIComponent(categorySlug)
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase()); // Ensure Title Case (e.g. "smartphones" -> "Smartphones")

    const categoryDescription =
      category?.description ||
      `Browse our collection of ${categoryName} products.`;

    // SEO Content Logic (DB -> Config -> Default)
    const normalizedSlug = categorySlug.toLowerCase();
    const defaultConfig = CATEGORY_SEO_DEFAULTS[normalizedSlug] || null;

    // Check key variations if direct match fails (e.g. 'smartphones' vs 'phones')
    const fallbackConfig = !defaultConfig
      ? Object.entries(CATEGORY_SEO_DEFAULTS).find(([key]) =>
        normalizedSlug.includes(key)
      )?.[1]
      : null;

    const effectiveConfig = defaultConfig || fallbackConfig;

    const seoContent = {
      heading:
        category?.seo_heading || effectiveConfig?.heading || categoryName, // Use clean name as default heading
      description:
        category?.seo_description ||
        effectiveConfig?.description ||
        categoryDescription,
      features: category?.seo_features || effectiveConfig?.features || [],
      faqs: category?.seo_faq || effectiveConfig?.faqs || [],
    };

    // Extract parent for easier access
    const parentCategory = category?.parent as unknown as {
      name: string;
      slug: string;
    } | null;

    // 4. Get products using optimized query with category_id join
    // First try to find products by category_id if we have a category
    let products: Product[] = [];
    let productsError = null;

    if (category?.id) {
      // Query products via product_categories (Many-to-Many) with inner join for filtering
      const { data: productData, error: err } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          description,
          price,
          compare_at_price,
          images,
          category,
          brand,
          condition,
          stock,
          product_categories!inner(category_id, categories(name, slug))
        `)
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .eq('product_categories.category_id', category.id)
        .limit(50);

      products = (productData || []) as unknown as Product[];
      productsError = err;
    }

    // Fallback: if no products found via category_id, try legacy TEXT category field, brand, or name
    if (products.length === 0) {
      const sanitizedCategoryName = categoryName.replace(/[,().]/g, '');
      const { data: productData, error: err } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          description,
          price,
          compare_at_price,
          images,
          category,
          brand,
          condition,
          stock,
          product_categories(categories(name, slug))
        `)
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .or(
          `category.ilike.%${sanitizedCategoryName}%,brand.ilike.%${sanitizedCategoryName}%,name.ilike.%${sanitizedCategoryName}%`
        ) // Use ilike and wildcards for broader matching
        .limit(50);

      products = (productData || []) as unknown as Product[];
      productsError = err;
    }

    if (productsError) {
      console.error(
        'Products query error:',
        JSON.stringify(productsError, null, 2)
      );
    }

    return {
      merchant,
      category: {
        name: categoryName,
        slug: categorySlug,
        description: categoryDescription,
        image: category?.image_url,
        seo: seoContent,
        parent: parentCategory,
      },
      products: (products || []) as Product[],
    };
  }
);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
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
  const description =
    categoryData.description ||
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
      ...(products.length > 0 &&
        products[0].images?.[0] && {
        images: [
          {
            url: products[0].images[0] as unknown as string,
            alt: categoryData.name,
          },
        ],
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

  // Read theme cookie server-side for SSR consistency (Phase 1: Cookie-Based Theme)
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('storefront-theme')?.value;
  const _initialTheme: V2ThemeMode | undefined =
    themeCookie === 'standard' || themeCookie === 'santa'
      ? themeCookie
      : undefined;

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

  // Generate BreadcrumbList schema (Hierarchical)
  const breadcrumbItems = [{ name: merchant.business_name, url: baseUrl }];

  // Add parent category if exists (e.g. Smartphones -> Samsung)
  if (categoryData.parent) {
    breadcrumbItems.push({
      name: categoryData.parent.name,
      url: `${baseUrl}/${categoryData.parent.slug}`,
    });
  }

  // Add current category
  breadcrumbItems.push({
    name: categoryData.name,
    url: `${baseUrl}/${categoryData.slug}`, // Ensure strict slug usage
  });

  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);

  // Generate FAQPage schema if FAQs exist
  const faqSchema =
    categoryData.seo.faqs && categoryData.seo.faqs.length > 0
      ? generateFAQSchema(categoryData.seo.faqs)
      : null;

  return (
    <>
      {/* CollectionPage Schema */}
      {/* codeql[js/html-injection] - Safe: JSON-LD sanitized via safeJsonLdStringify */}
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(collectionSchema),
        }}
      />
      {/* BreadcrumbList Schema */}
      {/* codeql[js/html-injection] - Safe: JSON-LD sanitized via safeJsonLdStringify */}
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbSchema),
        }}
      />
      {/* FAQPage Schema */}
      {faqSchema && (
        // codeql[js/html-injection] - Safe: JSON-LD sanitized via safeJsonLdStringify
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(faqSchema) }}
        />
      )}

      <Suspense fallback={<ProductGridSkeleton />}>
        <OgabasseyCategoryPage
          seoHeading={categoryData.seo.heading}
          seoDescription={categoryData.seo.description}
          seoFeatures={categoryData.seo.features}
          seoFaqs={categoryData.seo.faqs}
          categoryImage={categoryData.image}
          products={products.map((p) => {
            // Use unified normalizeProduct for consistent data extraction
            const normalized = normalizeProduct(p as unknown as RawDbProduct);
            // Map condition to expected enum values
            const conditionMap: Record<string, 'New' | 'Used' | 'Open Box'> = {
              New: 'New',
              new: 'New',
              Used: 'Used',
              used: 'Used',
              'Open Box': 'Open Box',
              open_box: 'Open Box',
            };
            return {
              id: normalized.id,
              name: normalized.name,
              slug: normalized.slug,
              description: normalized.description,
              price: `₦${normalized.price.toLocaleString()}`,
              rawPrice: normalized.price,
              image: normalized.image,
              images: normalized.images,
              category: normalized.category,
              brand: normalized.brand ?? undefined,
              condition: conditionMap[normalized.condition] || 'New',
              stock: normalized.stock,
            };
          })}
        />
      </Suspense>
    </>
  );
}
