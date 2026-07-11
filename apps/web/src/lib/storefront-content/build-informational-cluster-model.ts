import { formatCurrencyCompact } from '@/lib/currency';
import { buildCategorySupportLinks } from '@/lib/storefront-compare/build-commercial-support-links';
import { loadCategoryScopedSemanticInventorySafely } from '@/lib/storefront-product/load-category-scoped-semantic-inventory-safely';
import type {
  BuildInformationalClusterModelInput,
  InformationalClusterCategoryData,
  InformationalClusterModel,
} from './content-cluster-types';
import { inferContentClusterContext } from './infer-content-cluster-context';

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

function resolveOverrideCategoryName(
  categoryData: InformationalClusterCategoryData,
  fallbackCategorySlug: string
) {
  return (
    categoryData.category?.name ||
    categoryData.fallbackName ||
    fallbackCategorySlug
  );
}

// The override products and the scoped semantic inventory share this already-
// normalized shape (slug/name/price/brand/category_slug/key-specs/condition/
// stock), so both map directly — no RawDbProduct branch needed now that the
// rich getCachedCategoryPageData payload no longer feeds this model.
function toCategoryInventoryProduct(
  categorySlug: string,
  product: OverrideCategoryProduct
): CategoryInventoryProduct {
  return {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    price: product.price,
    category_slug: product.category_slug ?? categorySlug,
    product_key_specs: product.product_key_specs ?? null,
    condition: product.condition ?? null,
    stock: product.stock ?? null,
  };
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
  products: CategoryInventoryProduct[],
  countryCode?: string | null
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
      description: `${product.brand ?? 'Storefront pick'} • ${formatCurrencyCompact(product.price, countryCode || 'NG')}`,
    }));
}

export async function buildInformationalClusterModel(
  input: BuildInformationalClusterModelInput
): Promise<InformationalClusterModel | null> {
  const inferred = inferContentClusterContext(input.post);

  if (!inferred.categorySlug) {
    return null;
  }

  const categorySlug = inferred.categorySlug;
  let categoryName: string;
  let products: CategoryInventoryProduct[];

  if (input.categoryDataOverride) {
    const override = input.categoryDataOverride;
    if (override.isCollection) {
      return null;
    }
    categoryName = resolveOverrideCategoryName(override, categorySlug);
    products = (override.products ?? []).map((product) =>
      toCategoryInventoryProduct(categorySlug, product)
    );
  } else {
    // Repointed off the ~11-query getCachedCategoryPageData leg onto the single
    // category+children scoped semantic query. Degrades to an empty pool on a
    // transient failure — the cluster links are supplemental SEO content.
    const inventory = await loadCategoryScopedSemanticInventorySafely({
      merchantId: input.merchantId,
      categorySlug,
      storeSlug: input.merchantSlug,
      warningMessage: 'Failed to load informational cluster category inventory',
    });
    if (inventory.isCollection) {
      return null;
    }
    categoryName = inventory.categoryName;
    products = inventory.products.map((product) =>
      toCategoryInventoryProduct(categorySlug, product)
    );
  }
  const commerceLinks = buildCategorySupportLinks({
    storeUrl: input.storeUrl,
    categorySlug,
    categoryName,
    products,
  });

  return {
    heading: `Continue shopping ${categoryName.toLowerCase()}`,
    primaryCategoryLink: {
      href: `${input.storeUrl}/${categorySlug}`,
      label: `Shop more ${categoryName.toLowerCase()}`,
    },
    commerceLinks: commerceLinks.slice(0, 3),
    featuredProducts: buildFeaturedProducts(
      input.storeUrl,
      inferred.brands,
      products,
      input.countryCode
    ),
  };
}
