import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductDetailSkeleton } from '@/components/ui/skeletons';
import type { Product } from '@/lib/products';
import {
  escapeHtml,
  safeJsonLdStringify,
  sanitizeLikePattern,
} from '@/lib/sanitize-core';
import {
  generateBreadcrumbSchema,
  generateProductSchema,
  generateSlug,
  getProductUrl,
} from '@/lib/seo-utils';
import ProductDetailClient from '../../products/[productSlug]/product-detail-client';

// Enable ISR with 5 minute revalidation
export const revalidate = 300;

interface PageProps {
  params: Promise<{
    slug: string; // Store slug (merchant)
    category: string; // Category slug
    productSlug: string; // Product slug
  }>;
}

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

const getProduct = cache(
  async (storeSlug: string, categorySlug: string, productSlug: string) => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Get Merchant ID from store slug
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, business_name, social_media, payout_currency, business_type')
      .eq('slug', storeSlug)
      .single();

    if (merchantError || !merchant) {
      console.error('Merchant not found:', merchantError);
      return null;
    }

    // 2. Get Product by slug and merchant_id
    // Also verify category matches (for SEO canonical purposes)
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        productSlug
      );

    let query = supabase
      .from('products')
      .select('*')
      .eq('merchant_id', merchant.id);

    if (isUuid) {
      // Validated by isUuid regex, but sanitizing to be safe against injection
      const safeSlug = sanitizeLikePattern(productSlug);
      query = query.or(`slug.eq.${safeSlug},id.eq.${safeSlug}`);
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
    const productCategorySlug = product.category
      ? generateSlug(product.category)
      : null;
    const categoryMismatch =
      productCategorySlug && productCategorySlug !== categorySlug;

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

    return { product: product as Product, categoryMismatch, merchant };
  }
);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, category, productSlug } = await params;
  const result = await getProduct(slug, category, productSlug);

  if (!result?.product) {
    return {
      title: 'Product Not Found',
      description: 'The product you are looking for does not exist.',
    };
  }

  const { product, merchant } = result;

  const headersList = await headers();
  const host = headersList.get('host') || 'baci.app';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // Build canonical URL using the proper category-based format
  const canonicalPath = getProductUrl(product);
  const canonicalUrl = product.canonical_url || `${baseUrl}${canonicalPath}`;

  const socialMedia = merchant?.social_media as
    | Record<string, string>
    | undefined;

  return {
    title:
      product.meta_title ||
      `${product.name} | ${merchant?.business_name || 'Baci Store'}`,
    description: product.meta_description || product.description,
    keywords: product.keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: product.meta_title || product.name,
      description: product.meta_description || product.description,
      images: product.images?.length
        ? product.images.map((img) => ({ url: img.url, alt: img.alt }))
        : [
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
        site: socialMedia.twitter.startsWith('@')
          ? socialMedia.twitter
          : `@${socialMedia.twitter}`,
        creator: socialMedia.twitter.startsWith('@')
          ? socialMedia.twitter
          : `@${socialMedia.twitter}`,
      }),
    },
  };
}

export default async function CategoryProductPage({ params }: PageProps) {
  const { slug, category, productSlug } = await params;
  const result = await getProduct(slug, category, productSlug);

  if (!result?.product) {
    notFound();
  }

  const { product, merchant } = result;

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
    { name: product.name, url: productUrl },
  ];

  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);

  return (
    <>
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml - JSON-LD is sanitized and not executed */}
      <script
        type="application/ld+json"
        // nosemgrep: react-dangerouslysetinnerhtml, typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized with safeJsonLdStringify()
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(productSchema) }}
      />
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml - JSON-LD is sanitized and not executed */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized with safeJsonLdStringify()
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbSchema),
        }} // nosemgrep: react-dangerouslysetinnerhtml, typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
      />
      <Suspense fallback={<ProductDetailSkeleton />}>
        <ProductDetailClient product={product} />
      </Suspense>
    </>
  );
}
