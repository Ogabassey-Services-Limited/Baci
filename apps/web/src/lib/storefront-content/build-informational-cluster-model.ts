import { getCachedCategoryPageData } from '@/lib/cached-data';
import { normalizeProduct, type RawDbProduct } from '@/lib/normalize-product';
import { buildCategorySupportLinks } from '@/lib/storefront-compare/build-commercial-support-links';
import type {
  BuildInformationalClusterModelInput,
  InformationalClusterCategoryData,
  InformationalClusterModel,
} from './content-cluster-types';
import { inferContentClusterContext } from './infer-content-cluster-context';

type CachedCategoryPageData = Awaited<
  ReturnType<typeof getCachedCategoryPageData>
>;

interface CategoryInventoryProduct {
  slug: string;
  name: string;
  brand?: string | null;
  price: number;
  category_slug?: string | null;
  product_key_specs?: Record<string, unknown> | null;
  condition?: string | null;
  stock?: number | null;
}

type OverrideCategoryProduct = NonNullable<
  InformationalClusterCategoryData['products']
>[number];

function isRawDbProduct(value: unknown): value is RawDbProduct {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'name' in value &&
      'price' in value
  );
}

function resolveCategoryName(
  categoryData: CachedCategoryPageData | InformationalClusterCategoryData,
  fallbackCategorySlug: string
) {
  return (
    categoryData.category?.name ||
    ('fallbackName' in categoryData ? categoryData.fallbackName : null) ||
    fallbackCategorySlug
  );
}

function normalizeCategoryProducts(
  categorySlug: string,
  categoryData: CachedCategoryPageData | InformationalClusterCategoryData
): CategoryInventoryProduct[] {
  const products = categoryData.products ?? [];

  if (products.every((product) => !isRawDbProduct(product))) {
    return (products as OverrideCategoryProduct[]).map((product) => ({
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      price: product.price,
      category_slug: product.category_slug ?? categorySlug,
      product_key_specs: product.product_key_specs ?? null,
      condition: product.condition ?? null,
      stock: product.stock ?? null,
    }));
  }

  return (products as RawDbProduct[]).map((product) => {
    const normalized = normalizeProduct(product, {
      preferredCategorySlug: categorySlug,
    });

    return {
      slug: normalized.slug,
      name: normalized.name,
      brand: normalized.brand,
      price: normalized.price,
      category_slug: normalized.category_slug,
      product_key_specs: normalized.product_key_specs,
      condition: normalized.condition,
      stock: normalized.stock,
    };
  });
}

function isInStock(product: CategoryInventoryProduct) {
  return product.stock == null || product.stock > 0;
}

function buildProductHref(storeUrl: string, product: CategoryInventoryProduct) {
  return product.category_slug
    ? `${storeUrl}/${product.category_slug}/${product.slug}`
    : `${storeUrl}/products/${product.slug}`;
}

function buildFeaturedProducts(
  storeUrl: string,
  inferredBrands: string[],
  products: CategoryInventoryProduct[]
) {
  const inStockProducts = products.filter(isInStock);
  const normalizedBrands = inferredBrands.map((brand) => brand.toLowerCase());
  const preferredProducts =
    normalizedBrands.length > 0
      ? inStockProducts.filter((product) =>
          normalizedBrands.includes((product.brand ?? '').trim().toLowerCase())
        )
      : [];
  const selectedPool =
    preferredProducts.length > 0 ? preferredProducts : inStockProducts;

  return selectedPool
    .slice()
    .sort(
      (left, right) =>
        left.price - right.price || left.slug.localeCompare(right.slug)
    )
    .slice(0, 2)
    .map((product) => ({
      href: buildProductHref(storeUrl, product),
      title: product.name,
      description: `${product.brand ?? 'Storefront pick'} • ₦${product.price.toLocaleString('en-NG')}`,
    }));
}

export async function buildInformationalClusterModel(
  input: BuildInformationalClusterModelInput
): Promise<InformationalClusterModel | null> {
  const inferred = inferContentClusterContext(input.post);

  if (!inferred.categorySlug) {
    return null;
  }

  const categoryData =
    input.categoryDataOverride ??
    (await getCachedCategoryPageData(
      input.merchantId,
      inferred.categorySlug,
      input.merchantSlug
    ));

  if (!categoryData || categoryData.isCollection) {
    return null;
  }

  const categoryName = resolveCategoryName(categoryData, inferred.categorySlug);
  const products = normalizeCategoryProducts(
    inferred.categorySlug,
    categoryData
  );
  const commerceLinks = buildCategorySupportLinks({
    storeUrl: input.storeUrl,
    categorySlug: inferred.categorySlug,
    categoryName,
    products,
  });

  return {
    heading: `Continue shopping ${categoryName.toLowerCase()}`,
    primaryCategoryLink: {
      href: `${input.storeUrl}/${inferred.categorySlug}`,
      label: `Shop more ${categoryName.toLowerCase()}`,
    },
    commerceLinks: commerceLinks.slice(0, 3),
    featuredProducts: buildFeaturedProducts(
      input.storeUrl,
      inferred.brands,
      products
    ),
  };
}
