import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { CategoryPage as OgabasseyCategoryPage } from '@/components/storefront/ogabassey/pages/category-page';
import {
  getCachedCategoryPageData,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import type { RawDbProduct } from '@/lib/normalize-product';
import type { Product as SeoProduct } from '@/lib/products';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
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
  searchParams: Promise<{
    page?: string;
  }>;
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
  const currentPage = parseStorefrontPageParam(page);

  if (!currentPage) {
    notFound();
  }

  const merchant = await getMerchantByIdentifier(slug);

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
    country: merchant.country || 'NG',
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
    </>
  );
}
