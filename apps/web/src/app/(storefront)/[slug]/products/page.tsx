import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CategoryPage as OgabasseyCategoryPage } from '@/components/storefront/ogabassey/pages/category-page';
import type { Product as OgabasseyProduct } from '@/components/storefront/ogabassey/types';
import { ProductGridSkeleton } from '@/components/ui/skeletons';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { normalizeProduct, type RawDbProduct } from '@/lib/normalize-product';
import type { Product as SchemaProduct } from '@/lib/products';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
} from '@/lib/seo-utils';
import { createClient } from '@/lib/supabase/server';
import { isValidMerchantIdentifier } from '@/lib/validation';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

interface RawListingProduct {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  images?: (string | { url: string; alt?: string })[];
  category?: string;
  brand?: string;
  price: number;
  compare_at_price?: number;
  condition?: string;
  stock?: number;
  rating?: number;
  merchant_id?: string;
  status?: string;
  product_categories?: {
    categories:
      | {
          name: string;
          slug: string;
        }
      | {
          name: string;
          slug: string;
        }[]
      | null;
  }[];
}

function resolveStoreUrl(params: {
  host: string;
  slug: string;
  customDomain?: string;
}) {
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const isLocalhost =
    params.host.includes('localhost') || params.host.includes('127.0.0.1');

  let baseUrl = `${protocol}://${params.host}`;
  if (!isLocalhost && params.customDomain) {
    baseUrl = `https://${params.customDomain}`;
  }

  return {
    baseUrl,
    urlPrefix: isLocalhost ? `/${params.slug}` : '',
  };
}

function mapSchemaCondition(condition?: string): SchemaProduct['condition'] {
  const normalizedCondition = condition?.toLowerCase();

  switch (normalizedCondition) {
    case 'used':
      return 'used';
    case 'open box':
    case 'open_box':
      return 'open_box';
    case 'refurbished':
      return 'refurbished';
    default:
      return 'new';
  }
}

function mapListingCondition(
  condition?: string
): OgabasseyProduct['condition'] {
  const normalizedCondition = condition?.toLowerCase();

  switch (normalizedCondition) {
    case 'used':
      return 'Used';
    case 'open box':
    case 'open_box':
      return 'Open Box';
    default:
      return 'New';
  }
}

function mapProducts(rawProducts: RawDbProduct[]) {
  const normalizedProducts = rawProducts.map((product) =>
    normalizeProduct(product)
  );

  const listingProducts: OgabasseyProduct[] = normalizedProducts.map(
    (product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: `₦${product.price.toLocaleString()}`,
      rawPrice: product.price,
      image: product.image,
      images: product.images,
      category: product.category,
      categorySlug: product.category_slug,
      categories: {
        id: product.category_slug,
        name: product.category,
        slug: product.category_slug,
      },
      brand: product.brand ?? undefined,
      condition: mapListingCondition(product.condition),
      stock: product.stock,
      rating: product.rating,
      manage_stock: true,
    })
  );

  const schemaProducts: SchemaProduct[] = normalizedProducts.map((product) => ({
    id: product.id,
    merchant_id: product.merchant_id,
    name: product.name,
    description: product.description,
    status: product.status === 'archived' ? 'archived' : 'active',
    price: product.price,
    manage_stock: true,
    stock: product.stock,
    image: product.image,
    imageLarge: product.imageLarge,
    imageHint: '',
    brand: product.brand ?? '',
    gtin: '',
    mpn: '',
    category: product.category,
    category_slug: product.category_slug,
    categories: {
      name: product.category,
      slug: product.category_slug,
    },
    slug: product.slug,
    compare_at_price: product.compare_at_price ?? undefined,
    condition: mapSchemaCondition(product.condition),
    rating: product.rating,
  }));

  return { listingProducts, schemaProducts };
}

async function getAllProductsForListing(
  merchantId: string
): Promise<RawDbProduct[]> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from('products')
    .select(
      `
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
        rating,
        merchant_id,
        status,
        product_categories (
          categories (
            name,
            slug
          )
        )
      `
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Failed to fetch all products listing:', error);
    return [];
  }

  const rawProducts = (data || []) as RawListingProduct[];

  return rawProducts.map((product) => {
    const normalizedProduct: RawDbProduct = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      images: product.images,
      category: product.category,
      brand: product.brand,
      price: product.price,
      compare_at_price: product.compare_at_price,
      condition: product.condition,
      stock: product.stock,
      rating: product.rating,
      merchant_id: product.merchant_id,
      status: product.status,
      product_categories:
        product.product_categories?.map((entry) => ({
          categories: Array.isArray(entry.categories)
            ? (entry.categories[0] ?? null)
            : entry.categories,
        })) ?? [],
    };

    return normalizedProduct;
  });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!isValidMerchantIdentifier(slug)) {
    return { title: 'Store Not Found' };
  }

  const merchant = await getRequestScopedMerchant(slug);
  if (!merchant) {
    return { title: 'Store Not Found' };
  }

  const headersList = await headers();
  const host = headersList.get('host') || 'baci.app';
  const { baseUrl, urlPrefix } = resolveStoreUrl({
    host,
    slug,
    customDomain: merchant.custom_domain,
  });
  const canonicalUrl = `${baseUrl}${urlPrefix}/products`;
  const title = `All Products | ${merchant.business_name}`;
  const description =
    merchant.site_description ||
    `Browse all active products available at ${merchant.business_name}.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
      siteName: merchant.business_name,
      ...(merchant.logo_url
        ? {
            images: [{ url: merchant.logo_url, alt: merchant.business_name }],
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(merchant.logo_url ? { images: [merchant.logo_url] } : {}),
    },
  };
}

export default async function AllProductsPage({ params }: PageProps) {
  const { slug } = await params;

  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  const merchant = await getRequestScopedMerchant(slug);
  if (!merchant) {
    notFound();
  }

  const rawProducts = await getAllProductsForListing(merchant.id);
  const { listingProducts, schemaProducts } = mapProducts(rawProducts);

  const headersList = await headers();
  const host = headersList.get('host') || 'baci.app';
  const { baseUrl, urlPrefix } = resolveStoreUrl({
    host,
    slug,
    customDomain: merchant.custom_domain,
  });
  const homeUrl = `${baseUrl}${urlPrefix}`;
  const productsUrl = `${homeUrl}/products`;
  const description =
    merchant.site_description ||
    `Browse all active products available at ${merchant.business_name}.`;

  const collectionSchema = generateCollectionPageSchema({
    name: 'All Products',
    description,
    url: productsUrl,
    products: schemaProducts,
    merchantName: merchant.business_name,
    currency: merchant.payout_currency || 'NGN',
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: merchant.business_name, url: homeUrl },
    { name: 'All Products', url: productsUrl },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(collectionSchema),
        }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbSchema),
        }}
      />

      <Suspense fallback={<ProductGridSkeleton />}>
        <OgabasseyCategoryPage
          seoHeading={`All Products at ${merchant.business_name}`}
          seoDescription={description}
          products={listingProducts}
        />
      </Suspense>
    </>
  );
}
