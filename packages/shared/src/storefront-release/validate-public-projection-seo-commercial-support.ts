interface SeoProduct {
  available: boolean;
  brand?: string | null;
  categoryIds?: readonly string[];
  name: string;
  primaryCategoryId?: string | null;
  productKeySpecs?: Readonly<Record<string, unknown>> | null;
  slug: string;
}

interface SeoCategory {
  id: string;
  slug: string;
}

const BRAND_AUTHORITY_RULES = [
  { aliases: ['samsung'], key: 'samsung', minimumProducts: 5 },
  { aliases: ['google', 'google-pixel'], key: 'google', minimumProducts: 5 },
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

function toRouteSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function getCategoryProducts(
  categoryId: string,
  products: readonly SeoProduct[]
) {
  return products.filter(
    (product) =>
      product.available &&
      [
        ...(product.categoryIds ?? []),
        ...(product.primaryCategoryId ? [product.primaryCategoryId] : []),
      ].includes(categoryId)
  );
}

function getBrandRule(brandSlug: string) {
  return BRAND_AUTHORITY_RULES.find(({ aliases }) =>
    aliases.some((alias) => alias === brandSlug)
  );
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
    getCategoryProducts(category.id, products).filter((product) =>
      rule.aliases.some((alias) => alias === toRouteSlug(product.brand ?? ''))
    ).length >= rule.minimumProducts
  );
}

function haveDifferentComparableSpecs(left: SeoProduct, right: SeoProduct) {
  const leftSpecs = left.productKeySpecs ?? {};
  const rightSpecs = right.productKeySpecs ?? {};
  const sharedKeys = Object.keys(leftSpecs).filter((key) => key in rightSpecs);
  return sharedKeys.filter((key) => {
    const leftValue = leftSpecs[key];
    const rightValue = rightSpecs[key];
    if (Array.isArray(leftValue) && Array.isArray(rightValue))
      return (
        JSON.stringify([...leftValue].map(String).sort()) !==
        JSON.stringify([...rightValue].map(String).sort())
      );
    return leftValue !== rightValue;
  }).length;
}

/** Checks that a commercial-support SEO URL has enough projected inventory. */
export function hasEligibleCommercialSupportPath(
  path: string,
  categoriesBySlug: ReadonlyMap<string, SeoCategory>,
  products: readonly SeoProduct[]
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
      getCategoryProducts(category.id, products).filter(
        (product) =>
          getBrandRule(brandSlug)?.aliases.some(
            (alias) => alias === toRouteSlug(product.brand ?? '')
          ) && family.pattern.test(product.name.trim())
      ).length >= 3
    );
  }
  if (segments.length !== 3 || segments[1] !== 'compare') return false;
  const category = categoriesBySlug.get(segments[0] ?? '');
  const [left, right] = (segments[2] ?? '').split('-vs-');
  if (!category || !left || !right || left === right) return false;
  const categoryProducts = getCategoryProducts(category.id, products);
  const productSlugs = new Set(categoryProducts.map((product) => product.slug));
  if (productSlugs.has(left) && productSlugs.has(right)) {
    const leftProduct = categoryProducts.find(
      (product) => product.slug === left
    );
    const rightProduct = categoryProducts.find(
      (product) => product.slug === right
    );
    return Boolean(
      leftProduct &&
        rightProduct &&
        haveDifferentComparableSpecs(leftProduct, rightProduct) >= 3
    );
  }
  if (segments[0] !== 'smartphones' || left === right) return false;
  const leftCount = categoryProducts.filter(
    (product) => toRouteSlug(product.brand ?? '') === left
  ).length;
  const rightCount = categoryProducts.filter(
    (product) => toRouteSlug(product.brand ?? '') === right
  ).length;
  return leftCount >= 3 && rightCount >= 3;
}
