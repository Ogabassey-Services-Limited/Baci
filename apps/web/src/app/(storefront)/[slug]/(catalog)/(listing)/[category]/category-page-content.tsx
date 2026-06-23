import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { BreadcrumbList, CollectionPage, FAQPage } from 'schema-dts';
import { JsonLd, type JsonLdData } from '@/components/seo/json-ld';
import { CategoryPage as OgabasseyCategoryPage } from '@/components/storefront/ogabassey/pages/category-page';
import { V2ComparisonScope } from '@/components/storefront/ogabassey/providers/v2-comparison-scope';
import {
  getCachedCategoryPageData,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import type { RawDbProduct } from '@/lib/normalize-product';
import type { Product as SeoProduct } from '@/lib/products';
import {
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
  generateFAQSchema,
} from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl, buildStoreUrl } from '@/lib/store-url';
import { getPublishedClusterPosts } from '@/lib/storefront-content/get-published-cluster-posts';
import {
  parseStorefrontPageParam,
  STOREFRONT_PRODUCTS_PER_PAGE,
} from '@/lib/storefront-pagination';
import { isDomainIdentifier } from '@/lib/validation';
import { StorefrontRouteNotFoundContent } from '../../../storefront-route-not-found-content';
import {
  buildCategoryPageHubModel,
  normalizeCategoryPageProducts,
  resolveCategoryPageName,
  type StorefrontCategoryProduct,
} from './category-page-content-helpers';

interface PageProps {
  params: Promise<{
    slug: string;
    category: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function renderCategoryNotFoundContent({
  slug,
  title = 'Category not found',
  message = 'This category is unavailable or has moved.',
}: {
  slug: string;
  title?: string;
  message?: string;
}) {
  // Metadata generation remains the primary hard notFound/noindex gate. This
  // streamed content fallback is only for render-time races after a valid
  // merchant/category shell has already started.
  return (
    <StorefrontRouteNotFoundContent
      backHref={isDomainIdentifier(slug) ? '/' : `/${slug}`}
      message={message}
      title={title}
    />
  );
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
    // Case-insensitive comparison: DB values can be 'Refurbished' /
    // 'refurbished' / 'REFURBISHED'. Normalising here prevents refurbished
    // products from silently falling through to the `'new'` default.
    condition: (() => {
      const normalized = product.condition?.toLowerCase();
      if (normalized === 'used') return 'used';
      if (normalized === 'open box' || normalized === 'open_box')
        return 'open_box';
      if (normalized === 'refurbished') return 'refurbished';
      return 'new';
    })(),
    product_key_specs: product.product_key_specs ?? undefined,
  };
}

export async function CategoryPageContent({ params, searchParams }: PageProps) {
  const { slug, category } = await params;
  const { page } = await searchParams;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    notFound();
  }

  const currentPage = parseStorefrontPageParam(page);

  if (!currentPage) {
    return renderCategoryNotFoundContent({
      slug,
      title: 'Category page not found',
      message: 'This category page is unavailable or has moved.',
    });
  }

  const [data, guidePosts] = await Promise.all([
    getCachedCategoryPageData(merchant.id, category, slug),
    getPublishedClusterPosts(merchant.id),
  ]);

  if (!data.isCollection && data.isInactiveCategory) {
    return renderCategoryNotFoundContent({ slug });
  }

  // Doorway-trap stopgap (crawl-budget) — keep in lockstep with generateMetadata
  // so the rendered shell and the metadata robots agree. Unknown/typo slug:
  // no collection, no category row, no fuzzy-matched products.
  if (
    !data.isCollection &&
    !data.category?.id &&
    data.products.length === 0 &&
    !data.productsQueryFailed &&
    !data.categoryQueryFailed
  ) {
    return renderCategoryNotFoundContent({ slug });
  }

  const products = data.products as unknown as RawDbProduct[];
  const totalPages = Math.max(
    1,
    Math.ceil(products.length / STOREFRONT_PRODUCTS_PER_PAGE)
  );
  const pageStartIndex = (currentPage - 1) * STOREFRONT_PRODUCTS_PER_PAGE;

  if (currentPage > totalPages) {
    return renderCategoryNotFoundContent({
      slug,
      title: 'Category page not found',
      message: 'This category page is unavailable or has moved.',
    });
  }

  const categoryName = resolveCategoryPageName(data, category);
  const normalizedProducts = normalizeCategoryPageProducts(
    products,
    category,
    merchant.country
  );
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
    country: merchant.country || 'NG',
    currency: merchant.payout_currency || 'NGN',
  }) as unknown as JsonLdData<CollectionPage>;

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

  const breadcrumbSchema = generateBreadcrumbSchema(
    breadcrumbItems
  ) as unknown as JsonLdData<BreadcrumbList>;
  const faqSchema =
    hubContent.faqItems.length > 0
      ? (generateFAQSchema(
          hubContent.faqItems
        ) as unknown as JsonLdData<FAQPage>)
      : null;

  return (
    <>
      <JsonLd data={collectionSchema} />
      <JsonLd data={breadcrumbSchema} />
      {faqSchema && <JsonLd data={faqSchema} />}

      <V2ComparisonScope storageNamespace={merchant.id}>
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
      </V2ComparisonScope>
    </>
  );
}
