import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CategoryPage as OgabasseyCategoryPage } from '@/components/storefront/ogabassey/pages/category-page';
import type { Product as OgabasseyProduct } from '@/components/storefront/ogabassey/types';
import { ProductGridSkeleton } from '@/components/ui/skeletons';
import {
  getCachedCategoryPageData,
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import {
  normalizeProduct,
  type ProductKeySpecsRecord,
  type RawDbProduct,
} from '@/lib/normalize-product';
import type { Product as SeoProduct } from '@/lib/products';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
  generateFAQSchema,
} from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl, buildStoreUrl } from '@/lib/store-url';
import { buildCategoryHubModel } from '@/lib/storefront-category/build-category-hub-model';
import { getPublishedClusterPosts } from '@/lib/storefront-content/get-published-cluster-posts';
import {
  parseStorefrontPageParam,
  STOREFRONT_PRODUCTS_PER_PAGE,
} from '@/lib/storefront-pagination';
import { isDomainIdentifier } from '@/lib/validation';

interface PageProps {
  params: Promise<{
    slug: string;
    category: string;
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
}

type CategoryPageData = Awaited<ReturnType<typeof getCachedCategoryPageData>>;

type StorefrontCategoryProduct = OgabasseyProduct & {
  rawPrice: number;
  category_slug: string;
  product_key_specs?: ProductKeySpecsRecord;
};

const CONDITION_MAP: Record<string, OgabasseyProduct['condition']> = {
  New: 'New',
  new: 'New',
  Used: 'Used',
  used: 'Used',
  'Open Box': 'Open Box',
  open_box: 'Open Box',
  Refurbished: 'refurbished',
  refurbished: 'refurbished',
};

export function resolveCategoryPageName(
  data: CategoryPageData,
  categorySlug: string
) {
  return data.isCollection
    ? data.name || categorySlug
    : data.fallbackName || categorySlug;
}

export function normalizeCategoryPageProducts(
  products: RawDbProduct[],
  preferredCategorySlug?: string
): StorefrontCategoryProduct[] {
  return products.map((product) => {
    const normalized = normalizeProduct(product, {
      preferredCategorySlug,
    });

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
      condition: CONDITION_MAP[normalized.condition] || 'New',
      stock: normalized.stock,
      category_slug: normalized.category_slug,
      product_key_specs: normalized.product_key_specs ?? undefined,
    };
  });
}

export function buildCategoryPageHubModel(input: {
  data: CategoryPageData;
  categorySlug: string;
  categoryName: string;
  merchantBusinessName: string;
  storeUrl: string;
  products: StorefrontCategoryProduct[];
  guidePosts?: Awaited<ReturnType<typeof getPublishedClusterPosts>>;
}) {
  return buildCategoryHubModel({
    categorySlug: input.categorySlug,
    categoryName: input.categoryName,
    merchantBusinessName: input.merchantBusinessName,
    storeUrl: input.storeUrl,
    guidePosts: input.guidePosts ?? [],
    products: input.products.map((product) => ({
      slug: product.slug || '',
      name: product.name,
      brand: product.brand,
      condition: product.condition,
      price: product.rawPrice,
      category_slug: product.category_slug,
      product_key_specs: product.product_key_specs,
    })),
    categorySeo: input.data.isCollection
      ? undefined
      : {
          heading: input.data.category?.seo_heading,
          description: input.data.category?.seo_description,
          features: input.data.category?.seo_features,
          faqs: input.data.category?.seo_faq,
        },
    collectionSeo: input.data.isCollection ? input.data.seo : undefined,
    isCollection: input.data.isCollection,
  });
}

function toCollectionSchemaProduct(
  product: StorefrontCategoryProduct
): SeoProduct {
  return {
    id: String(product.id),
    name: product.name,
    description: product.description,
    status: 'active',
    price: product.rawPrice,
    manage_stock: true,
    stock: product.stock ?? 0,
    image: product.image,
    imageLarge: product.image,
    imageHint: '',
    brand: product.brand ?? '',
    gtin: '',
    mpn: '',
    category: product.category,
    category_slug: product.category_slug,
    slug: product.slug,
    condition:
      product.condition === 'Used'
        ? 'used'
        : product.condition === 'Open Box'
          ? 'open_box'
          : product.condition === 'refurbished'
            ? 'refurbished'
            : 'new',
    product_key_specs: product.product_key_specs ?? undefined,
  };
}

export async function CategoryPageContent({ params, searchParams }: PageProps) {
  const { slug, category } = await params;
  const { page } = await searchParams;
  const currentPage = parseStorefrontPageParam(page);

  if (!currentPage) {
    notFound();
  }

  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  const [data, guidePosts] = await Promise.all([
    getCachedCategoryPageData(merchant.id, category, slug),
    getPublishedClusterPosts(merchant.id),
  ]);
  const products = data.products as unknown as RawDbProduct[];
  const totalPages = Math.max(
    1,
    Math.ceil(products.length / STOREFRONT_PRODUCTS_PER_PAGE)
  );
  const pageStartIndex = (currentPage - 1) * STOREFRONT_PRODUCTS_PER_PAGE;

  if (currentPage > totalPages) {
    notFound();
  }

  const categoryName = resolveCategoryPageName(data, category);
  const normalizedProducts = normalizeCategoryPageProducts(products, category);
  const paginatedNormalizedProducts = normalizedProducts.slice(
    pageStartIndex,
    pageStartIndex + STOREFRONT_PRODUCTS_PER_PAGE
  );
  const collectionSchemaProducts = paginatedNormalizedProducts.map(
    toCollectionSchemaProduct
  );

  const baseUrl = buildStoreUrl(merchant);
  const requestScopedBaseUrl = buildRequestScopedStoreUrl(
    merchant,
    await headers()
  );
  const hubContent = buildCategoryPageHubModel({
    data,
    categorySlug: category,
    categoryName,
    merchantBusinessName: merchant.business_name,
    storeUrl: requestScopedBaseUrl,
    products: normalizedProducts,
    guidePosts,
  });
  const paginatedCategoryUrl =
    currentPage > 1
      ? `${baseUrl}/${category}?page=${currentPage}`
      : `${baseUrl}/${category}`;

  const collectionSchema = generateCollectionPageSchema({
    name: categoryName,
    description: hubContent.intro.description,
    url: paginatedCategoryUrl,
    products: collectionSchemaProducts,
    merchantName: merchant.business_name,
    currency: merchant.payout_currency || 'NGN',
  });

  const breadcrumbItems = [{ name: merchant.business_name, url: baseUrl }];
  const parent = data.category?.parent as unknown as {
    name: string;
    slug: string;
  } | null;

  if (!data.isCollection && parent) {
    breadcrumbItems.push({
      name: parent.name,
      url: `${baseUrl}/${parent.slug}`,
    });
  }

  breadcrumbItems.push({
    name: categoryName,
    url: `${baseUrl}/${category}`,
  });

  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);
  const faqSchema =
    hubContent.faqItems.length > 0
      ? generateFAQSchema(hubContent.faqItems)
      : null;

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
      {faqSchema && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(faqSchema) }}
        />
      )}

      <Suspense fallback={<ProductGridSkeleton />}>
        <OgabasseyCategoryPage
          seoHeading={hubContent.intro.heading}
          seoDescription={hubContent.intro.description}
          seoFeatures={hubContent.trustFeatures}
          seoFaqs={hubContent.faqItems}
          hubContent={hubContent}
          currentPage={currentPage}
          categoryImage={
            !data.isCollection ? data.category?.image_url : undefined
          }
          itemsPerPage={STOREFRONT_PRODUCTS_PER_PAGE}
          products={normalizedProducts}
        />
      </Suspense>
    </>
  );
}
