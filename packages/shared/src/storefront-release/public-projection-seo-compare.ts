interface SeoProduct {
  brand?: string | null;
  categoryIds?: readonly string[];
  primaryCategoryId?: string | null;
  productKeySpecs?: Readonly<Record<string, unknown>> | null;
  slug: string;
}

interface SeoCategory {
  id: string;
  slug: string;
}

interface CompareOptions {
  maintainedComparePaths?: ReadonlySet<string>;
}

const COMPARE_DELIMITER = '-vs-';
const COMPARE_ESCAPE_PREFIX = '~';

function generateSlug(value: string): string {
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCompareKey(key: string): string | null {
  if (!key.startsWith(COMPARE_ESCAPE_PREFIX)) return key;
  const encodedBytes = key.slice(COMPARE_ESCAPE_PREFIX.length);
  if (
    encodedBytes.length === 0 ||
    encodedBytes.length % 2 !== 0 ||
    /[^0-9a-f]/iu.test(encodedBytes)
  )
    return null;
  try {
    return new TextDecoder().decode(
      new Uint8Array(
        encodedBytes
          .match(/.{2}/gu)
          ?.map((pair) => Number.parseInt(pair, 16)) ?? []
      )
    );
  } catch {
    return null;
  }
}

function encodeCompareKey(key: string): string {
  if (
    !key.includes(COMPARE_DELIMITER) &&
    !key.startsWith(COMPARE_ESCAPE_PREFIX)
  )
    return key;
  const bytes = new TextEncoder().encode(key);
  return `${COMPARE_ESCAPE_PREFIX}${Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')}`;
}

function buildCanonicalCompareSlug(left: string, right: string): string {
  return [left, right].sort().map(encodeCompareKey).join(COMPARE_DELIMITER);
}

function parseCompareSlug(
  slug: string
): Readonly<{ canonicalSlug: string; left: string; right: string }> | null {
  const [leftPart, rightPart, ...rest] = slug.split(COMPARE_DELIMITER);
  if (!leftPart || !rightPart || rest.length > 0) return null;
  const left = parseCompareKey(leftPart);
  const right = parseCompareKey(rightPart);
  return left && right
    ? { canonicalSlug: buildCanonicalCompareSlug(left, right), left, right }
    : null;
}

function categoryProducts(
  category: SeoCategory,
  products: readonly SeoProduct[]
): readonly SeoProduct[] {
  return products.filter((product) =>
    [
      ...(product.categoryIds ?? []),
      ...(product.primaryCategoryId ? [product.primaryCategoryId] : []),
    ].includes(category.id)
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

function hasEligibleBrandCompare(
  categoryProductsForCompare: readonly SeoProduct[],
  canonicalSlug: string
) {
  const brandsByKey = new Map<string, { count: number; label: string }>();
  for (const product of categoryProductsForCompare) {
    const label = product.brand?.trim();
    if (!label) continue;
    const key = generateSlug(label);
    if (!key) continue;
    const existing = brandsByKey.get(key);
    if (existing) existing.count += 1;
    else brandsByKey.set(key, { count: 1, label });
  }
  const [left, right] = [...brandsByKey.entries()].sort(
    (a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])
  );
  if (!left || !right) return false;
  const candidateSlug = buildCanonicalCompareSlug(left[0], right[0]);
  return (
    candidateSlug === canonicalSlug && left[1].count >= 3 && right[1].count >= 3
  );
}

/** Checks product and brand comparison slugs against the released route policy. */
export function hasEligiblePublicProjectionComparePath(
  path: string,
  categoriesBySlug: ReadonlyMap<string, SeoCategory>,
  products: readonly SeoProduct[],
  options: CompareOptions = {}
): boolean {
  const segments = path.split('/').filter(Boolean);
  if (segments.length !== 3 || segments[1] !== 'compare') return false;
  const category = categoriesBySlug.get(segments[0] ?? '');
  const parsed = parseCompareSlug(segments[2] ?? '');
  if (
    !category ||
    !parsed ||
    parsed.left === parsed.right ||
    parsed.canonicalSlug !== segments[2]
  )
    return false;

  const scopedProducts = categoryProducts(category, products);
  const leftProduct = scopedProducts.find(
    (product) => product.slug === parsed.left
  );
  const rightProduct = scopedProducts.find(
    (product) => product.slug === parsed.right
  );
  if (leftProduct && rightProduct) {
    return (
      options.maintainedComparePaths?.has(path) === true &&
      haveDifferentComparableSpecs(leftProduct, rightProduct) >= 3
    );
  }
  if (leftProduct || rightProduct) return false;
  return hasEligibleBrandCompare(scopedProducts, parsed.canonicalSlug);
}
