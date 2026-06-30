import { normalizeProduct, type RawDbProduct } from '@/lib/normalize-product';
import { canonicalizeCategorySlug } from '@/lib/storefront-canonical-url';

export interface CompareIndexSection {
  categoryName: string;
  categorySlug: string;
  links: {
    href: string;
    label: string;
  }[];
}

interface CompareCategory {
  name?: string | null;
  slug: string | null;
}

export function getStorefrontPathPrefix(
  headersList: { has(name: string): boolean },
  merchantSlug: string
) {
  return headersList.has('x-custom-domain') ||
    headersList.has('x-merchant-slug')
    ? ''
    : `/${merchantSlug}`;
}

export function toRequestRelativeHref(
  href: string,
  storeUrl: string,
  pathPrefix: string
) {
  try {
    const url = new URL(href);
    const canonicalStoreUrl = new URL(storeUrl);

    if (url.origin === canonicalStoreUrl.origin) {
      const canonicalStorePathPrefix =
        canonicalStoreUrl.pathname === '/'
          ? ''
          : canonicalStoreUrl.pathname.replace(/\/+$/g, '');
      const relativeHref = `${url.pathname}${url.search}`;

      if (
        canonicalStorePathPrefix &&
        relativeHref.startsWith(`${canonicalStorePathPrefix}/`)
      ) {
        return relativeHref;
      }

      const normalizedPathPrefix = pathPrefix.replace(/\/+$/g, '');

      return normalizedPathPrefix
        ? `${normalizedPathPrefix}${relativeHref}`
        : relativeHref;
    }
  } catch {
    return href;
  }

  return href;
}

export function normalizeCompareProduct(
  product: RawDbProduct,
  categorySlug: string
) {
  const normalizedProduct = normalizeProduct(product, {
    preferredCategorySlug: categorySlug,
  });

  return {
    slug: normalizedProduct.slug,
    name: normalizedProduct.name,
    brand: normalizedProduct.brand,
    price: normalizedProduct.price,
    category_slug: normalizedProduct.category_slug,
    product_key_specs: normalizedProduct.product_key_specs,
  };
}

export function buildCanonicalCompareCategories<
  TCategory extends CompareCategory,
>(categories: TCategory[]) {
  return Array.from(
    new Map(
      categories
        .map((category) => {
          const categorySlug = canonicalizeCategorySlug(category.slug);

          return categorySlug
            ? [categorySlug, { ...category, categorySlug }]
            : null;
        })
        .filter(
          (entry): entry is [string, TCategory & { categorySlug: string }] =>
            entry !== null
        )
    ).values()
  );
}

export function sortCompareSections(
  left: CompareIndexSection,
  right: CompareIndexSection
) {
  return (
    right.links.length - left.links.length ||
    left.categoryName.localeCompare(right.categoryName)
  );
}
