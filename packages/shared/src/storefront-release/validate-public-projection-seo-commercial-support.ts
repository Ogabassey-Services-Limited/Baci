import { hasEligiblePublicProjectionComparePath } from './public-projection-seo-compare';

interface SeoProduct {
  available: boolean;
  brand?: string | null;
  categoryIds?: readonly string[];
  id?: string;
  name: string;
  priceMinor: number;
  primaryCategoryId?: string | null;
  productKeySpecs?: Readonly<Record<string, unknown>> | null;
  slug: string;
  updatedAt?: string;
}

interface SeoCategory {
  id: string;
  slug: string;
}

const BRAND_AUTHORITY_RULES = [
  { aliases: ['samsung'], key: 'samsung', minimumProducts: 5 },
  { aliases: ['google'], key: 'google', minimumProducts: 5 },
  { aliases: ['infinix'], key: 'infinix', minimumProducts: 5 },
  { aliases: ['tecno'], key: 'tecno', minimumProducts: 5 },
  { aliases: ['itel'], key: 'itel', minimumProducts: 5 },
  { aliases: ['xiaomi', 'redmi'], key: 'xiaomi', minimumProducts: 5 },
  { aliases: ['oppo'], key: 'oppo', minimumProducts: 5 },
] as const;

const MODEL_FAMILY_RULES = [
  { brand: 'samsung', family: 'galaxy-a', pattern: /^(?:samsung )?galaxy a/i },
  { brand: 'samsung', family: 'galaxy-s', pattern: /^(?:samsung )?galaxy s/i },
  { brand: 'samsung', family: 'galaxy-z', pattern: /^(?:samsung )?galaxy z/i },
  { brand: 'infinix', family: 'hot', pattern: /^(?:infinix )?hot/i },
  { brand: 'infinix', family: 'note', pattern: /^(?:infinix )?note/i },
  { brand: 'tecno', family: 'spark', pattern: /^(?:tecno )?spark/i },
  { brand: 'tecno', family: 'camon', pattern: /^(?:tecno )?camon/i },
  { brand: 'tecno', family: 'pop', pattern: /^(?:tecno )?pop/i },
  {
    brand: 'xiaomi',
    family: 'redmi-note',
    pattern: /^(?:xiaomi )?redmi note/i,
  },
  { brand: 'xiaomi', family: 'redmi-a', pattern: /^(?:xiaomi )?redmi a/i },
  { brand: 'xiaomi', family: 'redmi-15', pattern: /^(?:xiaomi )?redmi 15/i },
  { brand: 'xiaomi', family: 'xiaomi-t', pattern: /^(?:xiaomi )?[0-9]+t/i },
  { brand: 'oppo', family: 'a-series', pattern: /^(?:oppo\s+)?a(?=\s|\d)/i },
] as const;

const PRICE_BAND_RULES = [
  { category: 'smartphones', slug: 'under-500k', ceiling: 500_000 },
  { category: 'smartphones', slug: 'under-1m', ceiling: 1_000_000 },
  { category: 'laptops', slug: 'under-1m', ceiling: 1_000_000 },
  { category: 'smart-tvs', slug: 'under-2m', ceiling: 2_000_000 },
] as const;

const MIN_PRICE_BAND_PRODUCTS = 6;
const MIN_PRICE_BAND_BRANDS = 3;
const BRAND_AUTHORITY_PRODUCT_LIMIT = 48;

function toRouteSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function getCategoryProducts(
  categoryId: string,
  products: readonly SeoProduct[],
  options: { requireAvailability?: boolean } = {}
) {
  return products.filter(
    (product) =>
      (!options.requireAvailability || product.available) &&
      [
        ...(product.categoryIds ?? []),
        ...(product.primaryCategoryId ? [product.primaryCategoryId] : []),
      ].includes(categoryId)
  );
}

function getBrandAuthorityProducts(
  categoryId: string,
  products: readonly SeoProduct[],
  brandAliases?: readonly string[]
) {
  const categoryProducts = getCategoryProducts(categoryId, products, {
    requireAvailability: true,
  }).filter(
    (product) =>
      !brandAliases ||
      brandAliases.some((alias) => alias === toRouteSlug(product.brand ?? ''))
  );
  if (!categoryProducts.every((product) => product.updatedAt))
    return categoryProducts.slice(0, BRAND_AUTHORITY_PRODUCT_LIMIT);
  return [...categoryProducts]
    .sort(
      (left, right) =>
        (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '') ||
        (left.id ?? '').localeCompare(right.id ?? '')
    )
    .slice(0, BRAND_AUTHORITY_PRODUCT_LIMIT);
}

function getBrandRule(brandSlug: string) {
  return BRAND_AUTHORITY_RULES.find(({ key }) => key === brandSlug);
}

function getMinorUnitsPerMajorUnit(currency: string): number | null {
  try {
    const fractionDigits =
      new Intl.NumberFormat('en-US', {
        currency: currency.toUpperCase(),
        style: 'currency',
      }).resolvedOptions().maximumFractionDigits ?? 2;
    return 10 ** fractionDigits;
  } catch {
    return null;
  }
}

function hasEligibleBrand(
  categorySlug: string,
  brandSlug: string,
  categoriesBySlug: ReadonlyMap<string, SeoCategory>,
  products: readonly SeoProduct[]
) {
  if (categorySlug !== 'smartphones') return false;
  const category = categoriesBySlug.get(categorySlug);
  const rule = getBrandRule(brandSlug);
  if (!category || !rule) return false;
  return (
    getBrandAuthorityProducts(category.id, products, rule.aliases).filter(
      (product) =>
        product.available &&
        rule.aliases.some((alias) => alias === toRouteSlug(product.brand ?? ''))
    ).length >= rule.minimumProducts
  );
}

function hasEligiblePriceBand(
  categorySlug: string,
  priceBandSlug: string,
  categoriesBySlug: ReadonlyMap<string, SeoCategory>,
  products: readonly SeoProduct[],
  currency: string
) {
  const category = categoriesBySlug.get(categorySlug);
  const rule = PRICE_BAND_RULES.find(
    (entry) => entry.category === categorySlug && entry.slug === priceBandSlug
  );
  const minorUnitsPerMajorUnit = getMinorUnitsPerMajorUnit(currency);
  if (!category || !rule || minorUnitsPerMajorUnit === null) return false;

  const bandProducts = getCategoryProducts(category.id, products).filter(
    (product) => product.priceMinor <= rule.ceiling * minorUnitsPerMajorUnit
  );
  const brandKeys = new Set(
    bandProducts
      .map((product) => toRouteSlug(product.brand ?? ''))
      .filter(Boolean)
  );
  return (
    bandProducts.length >= MIN_PRICE_BAND_PRODUCTS &&
    brandKeys.size >= MIN_PRICE_BAND_BRANDS
  );
}

/** Checks that a commercial-support SEO URL has enough projected inventory. */
export function hasEligibleCommercialSupportPath(
  path: string,
  categoriesBySlug: ReadonlyMap<string, SeoCategory>,
  products: readonly SeoProduct[],
  options: {
    currency?: string;
    maintainedComparePaths?: ReadonlySet<string>;
  } = {}
) {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 3 && segments[1] === 'brands')
    return hasEligibleBrand(
      segments[0] ?? '',
      segments[2] ?? '',
      categoriesBySlug,
      products
    );
  if (
    segments.length === 5 &&
    segments[1] === 'brands' &&
    segments[3] === 'families'
  ) {
    const categorySlug = segments[0] ?? '';
    const brandSlug = segments[2] ?? '';
    const familySlug = segments[4] ?? '';
    const family = MODEL_FAMILY_RULES.find(
      (entry) =>
        entry.brand === getBrandRule(brandSlug)?.key &&
        entry.family === familySlug
    );
    const category = categoriesBySlug.get(categorySlug);
    if (
      !family ||
      !category ||
      !hasEligibleBrand(categorySlug, brandSlug, categoriesBySlug, products)
    )
      return false;
    return (
      getBrandAuthorityProducts(
        category.id,
        products,
        getBrandRule(brandSlug)?.aliases
      ).filter(
        (product) =>
          product.available &&
          getBrandRule(brandSlug)?.aliases.some(
            (alias) => alias === toRouteSlug(product.brand ?? '')
          ) &&
          family.pattern.test(product.name.trim())
      ).length >= 3
    );
  }
  if (segments.length === 3 && segments[1] === 'best-under')
    return hasEligiblePriceBand(
      segments[0] ?? '',
      segments[2] ?? '',
      categoriesBySlug,
      products,
      options.currency ?? 'NGN'
    );
  if (segments.length !== 3 || segments[1] !== 'compare') return false;
  return hasEligiblePublicProjectionComparePath(
    path,
    categoriesBySlug,
    products,
    { maintainedComparePaths: options.maintainedComparePaths }
  );
}
