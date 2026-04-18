# Ogabassey Phase 1 Compare Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add crawlable, indexable commercial comparison and price-band support pages for Ogabassey, then wire category/PDP internal links and sitemap coverage to those pages.

**Architecture:** Reuse the existing storefront category and product data pipeline, but move comparison intent into server-rendered route modules. Product-vs-product and brand-vs-brand pages will share a unified compare route and shared eligibility/canonical utilities. Price-band decision pages will use a separate support route with curated bands to avoid collisions with PDP slugs and to prevent thin-page sprawl.

**Tech Stack:** Next.js App Router, React Server Components, existing cached storefront loaders, Vitest, existing product spec extraction in `product-spec-data.ts`, JSON-LD helpers in `seo-utils.ts`

---

## File Map

### Create

- `apps/web/src/lib/storefront-compare/compare-types.ts`
  - Shared types for compare/support page candidates, eligibility decisions, price bands, and page models.
- `apps/web/src/lib/storefront-compare/price-band-taxonomy.ts`
  - Curated per-category price-band definitions and canonical slug helpers.
- `apps/web/src/lib/storefront-compare/compare-eligibility.ts`
  - Product-vs-product, brand-vs-brand, and price-band threshold checks plus canonical ordering utilities.
- `apps/web/src/lib/storefront-compare/compare-slugs.ts`
  - Slug parsing/building helpers for compare/support routes.
- `apps/web/src/lib/storefront-compare/load-compare-page.ts`
  - Shared server loader for product-vs-product and brand-vs-brand compare pages.
- `apps/web/src/lib/storefront-compare/load-price-band-page.ts`
  - Shared server loader for price-band decision pages.
- `apps/web/src/lib/storefront-compare/compare-schema.ts`
  - JSON-LD builders for compare/support pages (`BreadcrumbList`, `FAQPage`, `ItemList`).
- `apps/web/src/lib/storefront-compare/build-commercial-support-links.ts`
  - Deterministic link-builder for PDP/category support links.
- `apps/web/src/lib/storefront-compare/compare-eligibility.test.ts`
- `apps/web/src/lib/storefront-compare/compare-slugs.test.ts`
- `apps/web/src/lib/storefront-compare/load-compare-page.test.ts`
- `apps/web/src/lib/storefront-compare/load-price-band-page.test.ts`
- `apps/web/src/lib/storefront-compare/compare-schema.test.ts`
- `apps/web/src/lib/storefront-compare/build-commercial-support-links.test.ts`
- `apps/web/src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/page.tsx`
- `apps/web/src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/page.test.tsx`
- `apps/web/src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/compare-page-content.tsx`
- `apps/web/src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx`
- `apps/web/src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/page.tsx`
- `apps/web/src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/page.test.tsx`
- `apps/web/src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/price-band-page-content.tsx`
- `apps/web/src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/price-band-page-content.test.tsx`
- `apps/web/src/components/storefront/ogabassey/seo/commercial-support-links.tsx`
- `apps/web/src/components/storefront/ogabassey/seo/commercial-support-links.test.tsx`

### Modify

- `apps/web/src/app/(storefront)/[slug]/[category]/page.tsx`
  - Add compare/support internal-link metadata hooks only if needed by route metadata.
- `apps/web/src/app/(storefront)/[slug]/[category]/category-page-content.tsx`
  - Render compare/support link blocks for eligible brand-vs-brand and price-band pages.
- `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.tsx`
  - Add server-side compare/support suggestions for the PDP route.
- `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx`
  - Cover support-link rendering for the generic storefront PDP route.
- `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.tsx`
  - Add server-side compare/support suggestions for the canonical category PDP route.
- `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx`
  - Cover support-link rendering for Ogabassey and non-Ogabassey category PDP routing.
- `apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx`
  - Render crawlable support links on the live Ogabassey PDP surface.
- `apps/web/src/components/storefront/ogabassey/pages/product-details-page.test.tsx`
  - Cover support-link rendering on the Ogabassey PDP.
- `apps/web/src/app/(storefront)/[slug]/sitemap-data.ts`
  - Include eligible compare/support URLs in the storefront sitemap set.
- `apps/web/src/app/(storefront)/[slug]/sitemap-data.test.ts`
- `apps/web/src/components/storefront/ogabassey/product-spec-data.ts`
  - Expose any additional normalized fields needed for compare/support eligibility without duplicating parsing logic.

---

### Task 1: Build Compare Taxonomy and Canonical Rules

**Files:**
- Create: `apps/web/src/lib/storefront-compare/compare-types.ts`
- Create: `apps/web/src/lib/storefront-compare/price-band-taxonomy.ts`
- Create: `apps/web/src/lib/storefront-compare/compare-slugs.ts`
- Create: `apps/web/src/lib/storefront-compare/compare-eligibility.ts`
- Test: `apps/web/src/lib/storefront-compare/compare-slugs.test.ts`
- Test: `apps/web/src/lib/storefront-compare/compare-eligibility.test.ts`

- [ ] **Step 1: Write the failing slug and eligibility tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildCanonicalProductCompareSlug,
  buildCanonicalBrandCompareSlug,
  parseCompareSlug,
} from './compare-slugs';
import {
  canPublishBrandComparePage,
  canPublishPriceBandPage,
  canPublishProductComparePage,
  buildProductCompareCandidate,
  buildBrandCompareCandidate,
  buildPriceBandCandidate,
} from './compare-eligibility';
import { CURATED_PRICE_BANDS } from './price-band-taxonomy';

describe('compare slug canonicalization', () => {
  it('orders product pairs deterministically', () => {
    expect(
      buildCanonicalProductCompareSlug('iphone-17-pro-max', 'samsung-galaxy-z-trifold')
    ).toBe('iphone-17-pro-max-vs-samsung-galaxy-z-trifold');
  });

  it('orders brand pairs alphabetically', () => {
    expect(buildCanonicalBrandCompareSlug('Samsung', 'Apple')).toBe(
      'apple-vs-samsung'
    );
  });

  it('parses compare slugs into canonical compare keys', () => {
    expect(parseCompareSlug('apple-vs-samsung')).toMatchObject({
      leftKey: 'apple',
      rightKey: 'samsung',
      canonicalSlug: 'apple-vs-samsung',
    });
  });
});

describe('compare eligibility thresholds', () => {
  it('rejects brand compare pages below the hard minimum', () => {
    expect(
      canPublishBrandComparePage({
        categorySlug: 'smartphones',
        leftBrandActiveCount: 2,
        rightBrandActiveCount: 4,
        differentiatingSpecCount: 4,
      })
    ).toBe(false);
  });

  it('rejects price-band pages below the hard minimum', () => {
    expect(
      canPublishPriceBandPage({
        categorySlug: 'smartphones',
        bandSlug: 'under-500k',
        activeProductCount: 5,
        differentiatingSpecCount: 3,
      })
    ).toBe(false);
  });

  it('requires same-category product comparisons with enough spec coverage', () => {
    expect(
      canPublishProductComparePage({
        categorySlug: 'smartphones',
        leftCategorySlug: 'smartphones',
        rightCategorySlug: 'laptops',
        differentiatingSpecCount: 6,
      })
    ).toBe(false);
  });

  it('derives product-compare publication from shared product key specs', () => {
    expect(
      buildProductCompareCandidate({
        categorySlug: 'smartphones',
        leftProduct: {
          slug: 'iphone-17-pro-max',
          name: 'iPhone 17 Pro Max',
          category_slug: 'smartphones',
          product_key_specs: { chipset: 'A19 Pro', ram_gb: 8, storage_gb: 256 },
        },
        rightProduct: {
          slug: 'samsung-galaxy-z-trifold',
          name: 'Samsung Galaxy Z TriFold',
          category_slug: 'smartphones',
          product_key_specs: {
            chipset: 'Snapdragon 8 Elite',
            ram_gb: 16,
            storage_gb: 512,
          },
        },
      })
    ).toMatchObject({
      differentiatingSpecCount: 3,
      isIndexable: true,
    });
  });

  it('derives a single canonical brand-compare candidate from category products', () => {
    expect(
      buildBrandCompareCandidate({
        categorySlug: 'smartphones',
        products: [
          { slug: 'iphone-17-pro-max', name: 'iPhone 17 Pro Max', brand: 'Apple', price: 2100000 },
          { slug: 'iphone-17', name: 'iPhone 17', brand: 'Apple', price: 1500000 },
          { slug: 'iphone-16', name: 'iPhone 16', brand: 'Apple', price: 1250000 },
          { slug: 'samsung-galaxy-z-trifold', name: 'Samsung Galaxy Z TriFold', brand: 'Samsung', price: 7150000 },
          { slug: 'galaxy-s26-ultra', name: 'Galaxy S26 Ultra', brand: 'Samsung', price: 2500000 },
          { slug: 'galaxy-a56', name: 'Galaxy A56', brand: 'Samsung', price: 480000 },
        ],
      })
    ).toMatchObject({
      leftBrand: 'Apple',
      rightBrand: 'Samsung',
      isIndexable: true,
    });
  });

  it('derives price-band publication state from the same helper used by links and loaders', () => {
    expect(
      buildPriceBandCandidate({
        categorySlug: 'smartphones',
        band: CURATED_PRICE_BANDS.smartphones[1],
        products: [
          { slug: 'galaxy-a56', name: 'Galaxy A56', brand: 'Samsung', price: 480000 },
          { slug: 'galaxy-a36', name: 'Galaxy A36', brand: 'Samsung', price: 360000 },
          { slug: 'redmi-note-14', name: 'Redmi Note 14', brand: 'Xiaomi', price: 390000 },
          { slug: 'redmi-note-14-pro', name: 'Redmi Note 14 Pro', brand: 'Xiaomi', price: 450000 },
          { slug: 'tecno-camon-40', name: 'Tecno Camon 40', brand: 'Tecno', price: 410000 },
          { slug: 'infinix-zero-40', name: 'Infinix Zero 40', brand: 'Infinix', price: 420000 },
        ],
      })
    ).toMatchObject({
      activeProductCount: 6,
      isIndexable: true,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/lib/storefront-compare/compare-slugs.test.ts src/lib/storefront-compare/compare-eligibility.test.ts`

Expected: FAIL with missing module errors

- [ ] **Step 3: Implement the canonical compare utilities**

```ts
// compare-slugs.ts
import { generateSlug } from '@/lib/seo-utils';
import type { ParsedCompareSlug } from './compare-types';

export function buildCanonicalProductCompareSlug(left: string, right: string) {
  return [left, right].sort().join('-vs-');
}

export function buildCanonicalBrandCompareSlug(left: string, right: string) {
  return [generateSlug(left), generateSlug(right)].sort().join('-vs-');
}

export function parseCompareSlug(slug: string): ParsedCompareSlug | null {
  const [leftKey, rightKey, ...rest] = slug.split('-vs-');
  if (!leftKey || !rightKey || rest.length > 0) {
    return null;
  }
  return {
    leftKey,
    rightKey,
    canonicalSlug: [leftKey, rightKey].sort().join('-vs-'),
  };
}
```

```ts
// compare-types.ts
export interface ParsedCompareSlug {
  leftKey: string;
  rightKey: string;
  canonicalSlug: string;
}

export type ComparePageKind = 'product' | 'brand';

export interface PriceBandDefinition {
  slug: string;
  label: string;
  ceiling: number;
  floor?: number;
}
```

```ts
// compare-eligibility.ts
import type { PriceBandDefinition } from './compare-types';

const MIN_BRAND_COMPARE_PRODUCTS = 3;
const MIN_PRICE_BAND_PRODUCTS = 6;
const MIN_DIFFERENTIATING_SPECS = 3;

export function canPublishBrandComparePage(input: {
  categorySlug: string;
  leftBrandActiveCount: number;
  rightBrandActiveCount: number;
  differentiatingSpecCount: number;
}) {
  return (
    input.leftBrandActiveCount >= MIN_BRAND_COMPARE_PRODUCTS &&
    input.rightBrandActiveCount >= MIN_BRAND_COMPARE_PRODUCTS &&
    input.differentiatingSpecCount >= MIN_DIFFERENTIATING_SPECS
  );
}

export function canPublishPriceBandPage(input: {
  categorySlug: string;
  bandSlug: string;
  activeProductCount: number;
  differentiatingSpecCount: number;
}) {
  return (
    input.activeProductCount >= MIN_PRICE_BAND_PRODUCTS &&
    input.differentiatingSpecCount >= MIN_DIFFERENTIATING_SPECS
  );
}

export function canPublishProductComparePage(input: {
  categorySlug: string;
  leftCategorySlug: string;
  rightCategorySlug: string;
  differentiatingSpecCount: number;
}) {
  return (
    input.leftCategorySlug === input.categorySlug &&
    input.rightCategorySlug === input.categorySlug &&
    input.differentiatingSpecCount >= MIN_DIFFERENTIATING_SPECS
  );
}

export function buildProductCompareCandidate(input: {
  categorySlug: string;
  leftProduct: {
    slug: string;
    name: string;
    category_slug?: string | null;
    product_key_specs?: Record<string, unknown> | null;
  };
  rightProduct: {
    slug: string;
    name: string;
    category_slug?: string | null;
    product_key_specs?: Record<string, unknown> | null;
  };
}) {
  const leftSpecs = input.leftProduct.product_key_specs ?? {};
  const rightSpecs = input.rightProduct.product_key_specs ?? {};
  const overlappingKeys = Array.from(
    new Set([...Object.keys(leftSpecs), ...Object.keys(rightSpecs)])
  ).filter((key) => key in leftSpecs && key in rightSpecs);
  const differentiatingSpecCount = overlappingKeys.filter(
    (key) => leftSpecs[key] !== rightSpecs[key]
  ).length;

  return {
    leftProduct: input.leftProduct,
    rightProduct: input.rightProduct,
    differentiatingSpecCount,
    isIndexable: canPublishProductComparePage({
      categorySlug: input.categorySlug,
      leftCategorySlug: input.leftProduct.category_slug || '',
      rightCategorySlug: input.rightProduct.category_slug || '',
      differentiatingSpecCount,
    }),
  };
}

export function buildBrandCompareCandidate(input: {
  categorySlug: string;
  products: Array<{
    slug: string;
    name: string;
    brand?: string | null;
    price: number;
  }>;
}) {
  const brandCounts = new Map<string, number>();
  for (const product of input.products) {
    const brand = product.brand?.trim();
    if (!brand) continue;
    brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);
  }

  const [leftBrandEntry, rightBrandEntry] = [...brandCounts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
  );
  if (!leftBrandEntry || !rightBrandEntry) return null;

  const differentiatingSpecCount = Math.min(
    leftBrandEntry[1] + rightBrandEntry[1],
    4
  );

  return {
    leftBrand: leftBrandEntry[0],
    rightBrand: rightBrandEntry[0],
    leftBrandActiveCount: leftBrandEntry[1],
    rightBrandActiveCount: rightBrandEntry[1],
    differentiatingSpecCount,
    isIndexable: canPublishBrandComparePage({
      categorySlug: input.categorySlug,
      leftBrandActiveCount: leftBrandEntry[1],
      rightBrandActiveCount: rightBrandEntry[1],
      differentiatingSpecCount,
    }),
  };
}

export function buildPriceBandCandidate(input: {
  categorySlug: string;
  band: PriceBandDefinition;
  products: Array<{
    slug: string;
    name: string;
    brand?: string | null;
    price: number;
  }>;
}) {
  const bandProducts = input.products.filter(
    (product) =>
      product.price <= input.band.ceiling &&
      (input.band.floor ? product.price > input.band.floor : true)
  );
  const differentiatingSpecCount = Math.min(
    new Set(
      bandProducts.map((product) => (product.brand || '').trim()).filter(Boolean)
    ).size + 1,
    4
  );

  return {
    band: input.band,
    products: bandProducts,
    activeProductCount: bandProducts.length,
    differentiatingSpecCount,
    isIndexable: canPublishPriceBandPage({
      categorySlug: input.categorySlug,
      bandSlug: input.band.slug,
      activeProductCount: bandProducts.length,
      differentiatingSpecCount,
    }),
  };
}
```

- [ ] **Step 4: Add curated price-band taxonomy**

```ts
// price-band-taxonomy.ts
export const CURATED_PRICE_BANDS = {
  smartphones: [
    { slug: 'under-500k', label: 'Best Smartphones Under ₦500,000', ceiling: 500_000 },
    { slug: 'under-1m', label: 'Best Smartphones Under ₦1,000,000', ceiling: 1_000_000 },
  ],
  laptops: [
    { slug: 'under-1m', label: 'Best Laptops Under ₦1,000,000', ceiling: 1_000_000 },
  ],
  'smart-tvs': [
    { slug: 'under-2m', label: 'Best Smart TVs Under ₦2,000,000', ceiling: 2_000_000 },
  ],
} as const;
```

- [ ] **Step 5: Re-run the tests**

Run: `pnpm exec vitest run src/lib/storefront-compare/compare-slugs.test.ts src/lib/storefront-compare/compare-eligibility.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/storefront-compare
git commit -m "feat: add compare taxonomy and eligibility rules"
```

---

### Task 2: Build Shared Compare and Price-Band Page Loaders

**Files:**
- Create: `apps/web/src/lib/storefront-compare/load-compare-page.ts`
- Create: `apps/web/src/lib/storefront-compare/load-price-band-page.ts`
- Create: `apps/web/src/lib/storefront-compare/compare-schema.ts`
- Test: `apps/web/src/lib/storefront-compare/load-compare-page.test.ts`
- Test: `apps/web/src/lib/storefront-compare/load-price-band-page.test.ts`
- Test: `apps/web/src/lib/storefront-compare/compare-schema.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/product-spec-data.ts`

- [ ] **Step 1: Write failing loader tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadComparePage } from './load-compare-page';
import { loadPriceBandPage } from './load-price-band-page';

const mockGetCachedMerchant = vi.fn();
const mockGetCachedCategoryPageData = vi.fn();
const mockGetCachedProductWithDetails = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: (...args: unknown[]) => mockGetCachedMerchant(...args),
  getCachedCategoryPageData: (...args: unknown[]) =>
    mockGetCachedCategoryPageData(...args),
  getCachedProductWithDetails: (...args: unknown[]) =>
    mockGetCachedProductWithDetails(...args),
}));

const merchant = {
  id: 'merchant-1',
  slug: 'ogabassey',
  business_name: 'Ogabassey',
  payout_currency: 'NGN',
};

const categoryPageData = {
  isCollection: false,
  fallbackName: 'Smartphones',
  products: [
    {
      id: 'product-a',
      slug: 'iphone-17-pro-max',
      name: 'iPhone 17 Pro Max',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Apple',
      price: 2200000,
      product_key_specs: { chipset: 'A19 Pro', ram_gb: 8, storage_gb: 256 },
    },
    {
      id: 'product-b',
      slug: 'samsung-galaxy-z-trifold',
      name: 'Samsung Galaxy Z TriFold',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 2300000,
      product_key_specs: { chipset: 'Snapdragon 8 Elite', ram_gb: 16, storage_gb: 512 },
    },
    {
      id: 'product-c',
      slug: 'galaxy-a56',
      name: 'Galaxy A56',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 480000,
      product_key_specs: { chipset: 'Exynos', ram_gb: 8, storage_gb: 128 },
    },
    {
      id: 'product-d',
      slug: 'iphone-16e',
      name: 'iPhone 16e',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Apple',
      price: 495000,
      product_key_specs: { chipset: 'A18', ram_gb: 8, storage_gb: 128 },
    },
    {
      id: 'product-e',
      slug: 'iphone-15',
      name: 'iPhone 15',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Apple',
      price: 650000,
      product_key_specs: { chipset: 'A17', ram_gb: 8, storage_gb: 128 },
    },
    {
      id: 'product-f',
      slug: 'iphone-se',
      name: 'iPhone SE',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Apple',
      price: 550000,
      product_key_specs: { chipset: 'A16', ram_gb: 6, storage_gb: 128 },
    },
    {
      id: 'product-g',
      slug: 'galaxy-s24-fe',
      name: 'Galaxy S24 FE',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 700000,
      product_key_specs: { chipset: 'Exynos 2400e', ram_gb: 8, storage_gb: 256 },
    },
    {
      id: 'product-h',
      slug: 'galaxy-a36',
      name: 'Galaxy A36',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 360000,
      product_key_specs: { chipset: 'Snapdragon 7 Gen', ram_gb: 8, storage_gb: 128 },
    },
  ],
};

describe('loadComparePage', () => {
  beforeEach(() => {
    mockGetCachedMerchant.mockReset();
    mockGetCachedCategoryPageData.mockReset();
    mockGetCachedProductWithDetails.mockReset();
    mockGetCachedMerchant.mockResolvedValue(merchant);
    mockGetCachedCategoryPageData.mockResolvedValue(categoryPageData);
  });

  it('returns a canonical product-vs-product page model for eligible products', async () => {
    mockGetCachedProductWithDetails.mockResolvedValueOnce(categoryPageData.products[0]);
    mockGetCachedProductWithDetails.mockResolvedValueOnce(categoryPageData.products[1]);

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    });

    expect(result?.kind).toBe('product');
    expect(result?.canonicalSlug).toBe(
      'iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
    );
    expect(result?.canonicalUrl).toBe(
      'http://localhost:3000/ogabassey/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
    );
    expect(result?.metaTitle).toContain('iPhone 17 Pro Max vs Samsung Galaxy Z TriFold');
    expect(result?.comparisonRows[0]).toMatchObject({
      label: expect.any(String),
      leftValue: expect.any(String),
      rightValue: expect.any(String),
    });
    expect(result?.breadcrumbItems.at(-1)?.url).toBe(result?.canonicalUrl);
  });

  it('returns a canonical brand-vs-brand page model when both brands pass thresholds', async () => {
    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'apple-vs-samsung',
    });

    expect(result?.kind).toBe('brand');
    expect(result?.canonicalSlug).toBe('apple-vs-samsung');
    expect(result?.heading).toBe('Apple vs Samsung Smartphones');
    expect(result?.summaryVerdict).toMatch(/smartphones shoppers/i);
    expect(result?.faqItems.length).toBeGreaterThan(0);
    expect(result?.comparisonRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Active models' }),
      ])
    );
  });
});

describe('loadPriceBandPage', () => {
  beforeEach(() => {
    mockGetCachedMerchant.mockResolvedValue(merchant);
    mockGetCachedCategoryPageData.mockResolvedValue(categoryPageData);
  });

  it('returns a canonical model for an eligible curated band', async () => {
    const result = await loadPriceBandPage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      priceBandSlug: 'under-1m',
    });

    expect(result?.isIndexable).toBe(true);
    expect(result?.canonicalUrl).toBe(
      'http://localhost:3000/ogabassey/smartphones/best-under/under-1m'
    );
    expect(result?.products).toHaveLength(6);
  });

  it('returns a non-indexable model when the curated band is below threshold', async () => {
    const result = await loadPriceBandPage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      priceBandSlug: 'under-500k',
    });

    expect(result?.isIndexable).toBe(false);
  });
});

describe('buildComparePageSchemas', () => {
  it('builds breadcrumb and faq schema objects for compare pages', async () => {
    const { buildComparePageSchemas } = await import('./compare-schema');

    const schemas = buildComparePageSchemas({
      breadcrumbItems: [
        { name: 'Ogabassey', url: 'https://ogabassey.com' },
        { name: 'Smartphones', url: 'https://ogabassey.com/smartphones' },
      ],
      faqItems: [
        { question: 'Which phone is better?', answer: 'It depends on the buyer.' },
      ],
    });

    expect(schemas.breadcrumb['@type']).toBe('BreadcrumbList');
    expect(schemas.faq?.['@type']).toBe('FAQPage');
  });

  it('builds breadcrumb and ItemList schema objects for price-band pages', async () => {
    const { buildPriceBandPageSchemas } = await import('./compare-schema');

    const schemas = buildPriceBandPageSchemas({
      breadcrumbItems: [
        { name: 'Ogabassey', url: 'https://ogabassey.com' },
        { name: 'Smartphones', url: 'https://ogabassey.com/smartphones' },
      ],
      pageName: 'Best Smartphones Under ₦500,000',
      pageUrl: 'https://ogabassey.com/smartphones/best-under/under-500k',
      currency: 'NGN',
      products: [
        {
          id: 'product-c',
          slug: 'galaxy-a56',
          name: 'Galaxy A56',
          category: 'Smartphones',
          category_slug: 'smartphones',
          price: 480000,
          image: 'https://cdn.example.com/a56.jpg',
        },
      ],
    });

    expect(schemas.breadcrumb['@type']).toBe('BreadcrumbList');
    expect(schemas.itemList['@type']).toBe('ItemList');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/storefront-compare/load-compare-page.test.ts src/lib/storefront-compare/load-price-band-page.test.ts src/lib/storefront-compare/compare-schema.test.ts`

Expected: FAIL with missing modules

- [ ] **Step 3: Implement shared page loaders**

```ts
// load-compare-page.ts
import {
  getCachedCategoryPageData,
  getCachedMerchant,
  getCachedProductWithDetails,
} from '@/lib/cached-data';
import { buildOgabasseyProductSpecData } from '@/components/storefront/ogabassey/product-spec-data';
import {
  buildProductCompareCandidate,
  buildBrandCompareCandidate,
} from './compare-eligibility';
import { parseCompareSlug } from './compare-slugs';
import { generateSlug } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';

export async function loadComparePage(args: {
  merchantSlug: string;
  categorySlug: string;
  comparisonSlug: string;
}) {
  const merchant = await getCachedMerchant(args.merchantSlug);
  if (!merchant) return null;

  const parsed = parseCompareSlug(args.comparisonSlug);
  if (!parsed) return null;

  const categoryData = await getCachedCategoryPageData(
    merchant.id,
    args.categorySlug,
    args.merchantSlug
  );
  if (!categoryData || categoryData.isCollection) return null;

  const storeUrl = buildStoreUrl(merchant);
  const categoryName = categoryData.fallbackName || args.categorySlug;
  const canonicalUrl = `${storeUrl}/${args.categorySlug}/compare/${parsed.canonicalSlug}`;
  const payoutCurrency = merchant.payout_currency || 'NGN';
  const priceFormatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: payoutCurrency,
    maximumFractionDigits: 0,
  });

  const products = (categoryData.products ?? []) as Array<{
    slug?: string | null;
    name?: string | null;
    brand?: string | null;
    price?: number | null;
    category_slug?: string | null;
    product_key_specs?: Record<string, unknown> | null;
  }>;

  const leftProduct = products.find((product) => product.slug === parsed.leftKey);
  const rightProduct = products.find((product) => product.slug === parsed.rightKey);

  if (leftProduct && rightProduct) {
    const leftDetails = await getCachedProductWithDetails(merchant.id, parsed.leftKey);
    const rightDetails = await getCachedProductWithDetails(merchant.id, parsed.rightKey);
    if (!leftDetails || !rightDetails) return null;

    const leftSpecs = buildOgabasseyProductSpecData(leftDetails).specs;
    const rightSpecs = buildOgabasseyProductSpecData(rightDetails).specs;
    const comparisonRows = Array.from(
      new Set([
        ...leftSpecs.map((item) => item.label),
        ...rightSpecs.map((item) => item.label),
      ])
    )
      .map((label) => ({
        label,
        leftValue:
          leftSpecs.find((candidate) => candidate.label === label)?.value || '—',
        rightValue:
          rightSpecs.find((candidate) => candidate.label === label)?.value || '—',
      }))
      .filter((row) => row.leftValue !== '—' || row.rightValue !== '—');
    const differingRows = comparisonRows.filter(
      (row) => row.leftValue !== row.rightValue
    );
    const productCandidate = buildProductCompareCandidate({
      categorySlug: args.categorySlug,
      leftProduct: {
        slug: leftDetails.slug || parsed.leftKey,
        name: leftDetails.name,
        category_slug: leftProduct.category_slug || '',
        product_key_specs:
          leftDetails.product_key_specs || leftProduct.product_key_specs,
      },
      rightProduct: {
        slug: rightDetails.slug || parsed.rightKey,
        name: rightDetails.name,
        category_slug: rightProduct.category_slug || '',
        product_key_specs:
          rightDetails.product_key_specs || rightProduct.product_key_specs,
      },
    });
    const keyDifferences = differingRows
      .slice(0, 3)
      .map(
        (row) =>
          `${row.label}: ${leftDetails.name} ${row.leftValue}, ${rightDetails.name} ${row.rightValue}`
      );
    const breadcrumbItems = [
      { name: merchant.business_name, url: storeUrl },
      { name: categoryName, url: `${storeUrl}/${args.categorySlug}` },
      {
        name: `${leftDetails.name} vs ${rightDetails.name}`,
        url: canonicalUrl,
      },
    ];

    return {
      kind: 'product' as const,
      canonicalSlug: parsed.canonicalSlug,
      canonicalUrl,
      metaTitle: `${leftDetails.name} vs ${rightDetails.name} | ${merchant.business_name}`,
      metaDescription: `Compare ${leftDetails.name} and ${rightDetails.name} across price, specs, and buying priorities on ${merchant.business_name}.`,
      heading: `${leftDetails.name} vs ${rightDetails.name}`,
      summaryVerdict: `${leftDetails.name} and ${rightDetails.name} both target ${categoryName.toLowerCase()} buyers, but the deciding factors are ${keyDifferences
        .slice(0, 2)
        .map((item) => item.split(':')[0].toLowerCase())
        .join(' and ')}.`,
      keyDifferences,
      comparisonRows,
      faqItems: [
        {
          question: `Which is better, ${leftDetails.name} or ${rightDetails.name}?`,
          answer: `Use the comparison table to choose based on the specs that matter most to you, especially ${keyDifferences
            .slice(0, 2)
            .map((item) => item.split(':')[0].toLowerCase())
            .join(' and ')}.`,
        },
        {
          question: `Is ${leftDetails.name} worth the price difference?`,
          answer: `${leftDetails.name} is the better fit if its advantages in ${keyDifferences
            .slice(0, 1)
            .map((item) => item.split(':')[0].toLowerCase())
            .join(' ')} matter more to the buyer than the savings on ${rightDetails.name}.`,
        },
      ],
      breadcrumbItems,
      merchant,
      isIndexable: productCandidate.isIndexable,
      leftProduct: leftDetails,
      rightProduct: rightDetails,
    };
  }

  const normalizedProducts = products
    .filter(
      (product): product is {
        slug: string;
        name: string;
        brand?: string | null;
        price: number;
        category_slug?: string | null;
      } =>
        Boolean(product.slug) &&
        Boolean(product.name) &&
        typeof product.price === 'number'
    )
    .map((product) => ({
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      price: product.price,
      category_slug: product.category_slug,
    }));
  const brandCandidate = buildBrandCompareCandidate({
    categorySlug: args.categorySlug,
    products: normalizedProducts,
  });
  if (
    !brandCandidate ||
    generateSlug(brandCandidate.leftBrand) !== parsed.leftKey ||
    generateSlug(brandCandidate.rightBrand) !== parsed.rightKey
  ) {
    return null;
  }

  const leftBrandProducts = normalizedProducts.filter(
    (product) => generateSlug(product.brand || '') === parsed.leftKey
  );
  const rightBrandProducts = normalizedProducts.filter(
    (product) => generateSlug(product.brand || '') === parsed.rightKey
  );
  const priceRange = (brandProducts: typeof leftBrandProducts) => {
    const prices = brandProducts.map((product) => product.price);
    return `${priceFormatter.format(Math.min(...prices))} to ${priceFormatter.format(
      Math.max(...prices)
    )}`;
  };
  const comparisonRows = [
    {
      label: 'Active models',
      leftValue: String(leftBrandProducts.length),
      rightValue: String(rightBrandProducts.length),
    },
    {
      label: 'Price range',
      leftValue: priceRange(leftBrandProducts),
      rightValue: priceRange(rightBrandProducts),
    },
    {
      label: 'Cheapest model',
      leftValue:
        leftBrandProducts
          .slice()
          .sort((left, right) => left.price - right.price)[0]?.name || '—',
      rightValue:
        rightBrandProducts
          .slice()
          .sort((left, right) => left.price - right.price)[0]?.name || '—',
    },
    {
      label: 'Premium model',
      leftValue:
        leftBrandProducts
          .slice()
          .sort((left, right) => right.price - left.price)[0]?.name || '—',
      rightValue:
        rightBrandProducts
          .slice()
          .sort((left, right) => right.price - left.price)[0]?.name || '—',
    },
  ];
  const keyDifferences = [
    `${brandCandidate.leftBrand} has ${brandCandidate.leftBrandActiveCount} active models in this category.`,
    `${brandCandidate.rightBrand} has ${brandCandidate.rightBrandActiveCount} active models in this category.`,
    `${brandCandidate.leftBrand} ranges from ${comparisonRows[1].leftValue}, while ${brandCandidate.rightBrand} ranges from ${comparisonRows[1].rightValue}.`,
  ];
  const heading = `${brandCandidate.leftBrand} vs ${brandCandidate.rightBrand} ${categoryName}`;
  const breadcrumbItems = [
    { name: merchant.business_name, url: storeUrl },
    { name: categoryName, url: `${storeUrl}/${args.categorySlug}` },
    { name: heading, url: canonicalUrl },
  ];

  return {
    kind: 'brand' as const,
    canonicalSlug: parsed.canonicalSlug,
    canonicalUrl,
    metaTitle: `${heading} | ${merchant.business_name}`,
    metaDescription: `Compare ${brandCandidate.leftBrand} and ${brandCandidate.rightBrand} ${categoryName.toLowerCase()} by live model count, pricing, and buying fit on ${merchant.business_name}.`,
    heading,
    summaryVerdict: `${brandCandidate.leftBrand} and ${brandCandidate.rightBrand} both matter for ${categoryName.toLowerCase()} shoppers, but their active model counts and price positioning differ.`,
    keyDifferences,
    comparisonRows,
    faqItems: [
      {
        question: `Which brand is better for ${categoryName.toLowerCase()}, ${brandCandidate.leftBrand} or ${brandCandidate.rightBrand}?`,
        answer: `Use the comparison table to decide whether ${brandCandidate.leftBrand}'s catalog depth or ${brandCandidate.rightBrand}'s price spread is the better fit.`,
      },
      {
        question: `Does ${brandCandidate.leftBrand} have more options than ${brandCandidate.rightBrand}?`,
        answer: `${brandCandidate.leftBrand} currently has ${brandCandidate.leftBrandActiveCount} active models in this category, while ${brandCandidate.rightBrand} has ${brandCandidate.rightBrandActiveCount}.`,
      },
    ],
    breadcrumbItems,
    merchant,
    isIndexable: brandCandidate.isIndexable,
    leftBrand: brandCandidate.leftBrand,
    rightBrand: brandCandidate.rightBrand,
    leftBrandProducts,
    rightBrandProducts,
  };
}
```

- [ ] **Step 4: Implement compare/support JSON-LD helpers**

```ts
// compare-schema.ts
import { generateBreadcrumbSchema, generateFAQSchema, getProductUrl } from '@/lib/seo-utils';

export function buildComparePageSchemas(input: {
  breadcrumbItems: Array<{ name: string; url: string }>;
  faqItems: Array<{ question: string; answer: string }>;
}) {
  return {
    breadcrumb: generateBreadcrumbSchema(input.breadcrumbItems),
    faq: input.faqItems.length > 0 ? generateFAQSchema(input.faqItems) : null,
  };
}

export function buildPriceBandPageSchemas(input: {
  breadcrumbItems: Array<{ name: string; url: string }>;
  pageName: string;
  pageUrl: string;
  currency: string;
  products: Array<{
    id: string;
    name: string;
    slug: string;
    category: string;
    category_slug: string;
    price: number;
    image?: string | null;
    description?: string | null;
  }>;
}) {
  return {
    breadcrumb: generateBreadcrumbSchema(input.breadcrumbItems),
    itemList: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: input.pageName,
      url: input.pageUrl,
      itemListElement: input.products.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Product',
          name: product.name,
          image: product.image || undefined,
          description: product.description || undefined,
          url: new URL(getProductUrl(product), input.pageUrl).toString(),
          offers: {
            '@type': 'Offer',
            price: product.price,
            priceCurrency: input.currency,
            availability: 'https://schema.org/InStock',
          },
        },
      })),
    },
  };
}
```

```ts
// load-price-band-page.ts
import { getCachedCategoryPageData, getCachedMerchant } from '@/lib/cached-data';
import { normalizeProduct, type RawDbProduct } from '@/lib/normalize-product';
import { buildStoreUrl } from '@/lib/store-url';
import { buildPriceBandCandidate } from './compare-eligibility';
import { CURATED_PRICE_BANDS } from './price-band-taxonomy';

export async function loadPriceBandPage(args: {
  merchantSlug: string;
  categorySlug: string;
  priceBandSlug: string;
}) {
  const merchant = await getCachedMerchant(args.merchantSlug);
  if (!merchant) return null;

  const categoryData = await getCachedCategoryPageData(
    merchant.id,
    args.categorySlug,
    args.merchantSlug
  );
  if (!categoryData || categoryData.isCollection) return null;

  const band = (CURATED_PRICE_BANDS[args.categorySlug] ?? []).find(
    (candidate) => candidate.slug === args.priceBandSlug
  );
  if (!band) return null;

  const normalizedProducts = (categoryData.products ?? []).map((product) =>
    normalizeProduct(product as RawDbProduct)
  );
  const bandCandidate = buildPriceBandCandidate({
    categorySlug: args.categorySlug,
    band,
    products: normalizedProducts.map((product) => ({
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      price: product.price,
    })),
  });
  const storeUrl = buildStoreUrl(merchant);
  const canonicalUrl = `${storeUrl}/${args.categorySlug}/best-under/${band.slug}`;

  return {
    merchant,
    canonicalUrl,
    metaTitle: `${band.label} | ${merchant.business_name}`,
    metaDescription: `Compare the best ${categoryData.fallbackName?.toLowerCase() || args.categorySlug} under ${band.label.replace(/^Best\s+/i, '')} from ${merchant.business_name}.`,
    heading: band.label,
    intro: `These are the strongest ${categoryData.fallbackName?.toLowerCase() || args.categorySlug} options below the ${band.label.replace(/^Best\s+/i, '').toLowerCase()} price band.`,
    breadcrumbItems: [
      { name: merchant.business_name, url: storeUrl },
      {
        name: categoryData.fallbackName || args.categorySlug,
        url: `${storeUrl}/${args.categorySlug}`,
      },
      { name: band.label, url: canonicalUrl },
    ],
    products: bandCandidate.products,
    isIndexable: bandCandidate.isIndexable,
    pathPrefix: process.env.NODE_ENV === 'development' ? `/${merchant.slug}` : '',
    payoutCurrency: merchant.payout_currency || 'NGN',
  };
}
```

- [ ] **Step 5: Re-run loader/schema tests**

Run: `pnpm exec vitest run src/lib/storefront-compare/load-compare-page.test.ts src/lib/storefront-compare/load-price-band-page.test.ts src/lib/storefront-compare/compare-schema.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/storefront-compare apps/web/src/components/storefront/ogabassey/product-spec-data.ts
git commit -m "feat: add compare page data loaders"
```

---

### Task 3: Add Crawlable Compare Pages

**Files:**
- Create: `apps/web/src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/page.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/page.test.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/compare-page-content.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx`

- [ ] **Step 1: Write failing route and render tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateMetadata } from './page';

const mockLoadComparePage = vi.fn();

vi.mock('@/lib/storefront-compare/load-compare-page', () => ({
  loadComparePage: (...args: unknown[]) => mockLoadComparePage(...args),
}));

const comparePageModel = {
  kind: 'product' as const,
  canonicalSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
  canonicalUrl:
    'https://ogabassey.com/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
  metaTitle: 'iPhone 17 Pro Max vs Samsung Galaxy Z TriFold | Ogabassey',
  metaDescription: 'Compare iPhone 17 Pro Max and Samsung Galaxy Z TriFold specs, pricing, and buying advice.',
  heading: 'iPhone 17 Pro Max vs Samsung Galaxy Z TriFold',
  summaryVerdict: 'Both phones target flagship buyers, but their strengths differ.',
  keyDifferences: ['Apple ecosystem vs foldable productivity', 'Battery life vs multitasking'],
  comparisonRows: [
    { label: 'Processor', leftValue: 'A19 Pro', rightValue: 'Snapdragon 8 Elite' },
  ],
  faqItems: [{ question: 'Which phone is better for multitasking?', answer: 'The TriFold.' }],
  breadcrumbItems: [
    { name: 'Ogabassey', url: 'https://ogabassey.com' },
    { name: 'Smartphones', url: 'https://ogabassey.com/smartphones' },
    {
      name: 'iPhone 17 Pro Max vs Samsung Galaxy Z TriFold',
      url: 'https://ogabassey.com/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    },
  ],
  isIndexable: true,
};

beforeEach(() => {
  mockLoadComparePage.mockReset();
  mockLoadComparePage.mockResolvedValue(comparePageModel);
});

describe('compare page metadata', () => {
  it('emits canonical metadata for product compare pages', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey',
        category: 'smartphones',
        comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
      }),
    } as never);

    expect(metadata.alternates?.canonical).toContain(
      '/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
    );
  });
});
```

```tsx
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadComparePage = vi.fn();

vi.mock('@/lib/storefront-compare/load-compare-page', () => ({
  loadComparePage: (...args: unknown[]) => mockLoadComparePage(...args),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: (value: unknown) => JSON.stringify(value),
}));

const { ComparePageContent } = await import('./compare-page-content');

describe('ComparePageContent', () => {
  beforeEach(() => {
    mockLoadComparePage.mockReset();
    mockLoadComparePage.mockResolvedValue(comparePageModel);
  });

  it('renders the verdict, key differences, and comparison table', async () => {
    render(
      (await ComparePageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          category: 'smartphones',
          comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
        }),
      })) as ReactElement
    );

    expect(
      screen.getByRole('heading', {
        name: /iPhone 17 Pro Max vs Samsung Galaxy Z TriFold/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Both phones target flagship buyers/i)).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: /Product comparison table/i })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/page.test.tsx src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx`

Expected: FAIL with missing route modules

- [ ] **Step 3: Implement server-rendered compare route**

```ts
// page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductGridSkeleton } from '@/components/ui/skeletons';
import { loadComparePage } from '@/lib/storefront-compare/load-compare-page';
import { ComparePageContent } from './compare-page-content';

export async function generateMetadata({ params }: {
  params: Promise<{ slug: string; category: string; comparisonSlug: string }>;
}): Promise<Metadata> {
  const resolved = await params;
  const page = await loadComparePage({
    merchantSlug: resolved.slug,
    categorySlug: resolved.category,
    comparisonSlug: resolved.comparisonSlug,
  });

  if (!page || !page.isIndexable) notFound();

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: {
      canonical: page.canonicalUrl,
    },
  };
}

export default function ComparePage(props: {
  params: Promise<{ slug: string; category: string; comparisonSlug: string }>;
}) {
  return (
    <Suspense fallback={<ProductGridSkeleton count={4} columns={2} />}>
      <ComparePageContent {...props} />
    </Suspense>
  );
}
```

- [ ] **Step 4: Implement compare page content with FAQ + spec table**

```tsx
// compare-page-content.tsx
import { notFound } from 'next/navigation';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { buildComparePageSchemas } from '@/lib/storefront-compare/compare-schema';
import { loadComparePage } from '@/lib/storefront-compare/load-compare-page';

export async function ComparePageContent({
  params,
}: {
  params: Promise<{ slug: string; category: string; comparisonSlug: string }>;
}) {
  const resolved = await params;
  const page = await loadComparePage({
    merchantSlug: resolved.slug,
    categorySlug: resolved.category,
    comparisonSlug: resolved.comparisonSlug,
  });

  if (!page || !page.isIndexable) {
    notFound();
  }

  const schemas = buildComparePageSchemas({
    breadcrumbItems: page.breadcrumbItems,
    faqItems: page.faqItems,
  });

      return (
        <>
          <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
            dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(schemas.breadcrumb) }}
          />
          {schemas.faq && (
            <script
              type="application/ld+json"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
              dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(schemas.faq) }}
            />
          )}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold">{page.heading}</h1>
        <p className="mt-3 text-base text-muted-foreground">{page.summaryVerdict}</p>
        <ul className="mt-4 list-disc space-y-2 pl-5">
          {page.keyDifferences.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <table aria-label="Product comparison table" className="mt-8 w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left">Spec</th>
              <th className="text-left">{page.heading.split(' vs ')[0]}</th>
              <th className="text-left">{page.heading.split(' vs ')[1]}</th>
            </tr>
          </thead>
          <tbody>
            {page.comparisonRows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="py-3 text-left font-medium">
                  {row.label}
                </th>
                <td className="py-3">{row.leftValue}</td>
                <td className="py-3">{row.rightValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {page.faqItems.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-semibold">Buyer FAQ</h2>
            <div className="mt-4 space-y-4">
              {page.faqItems.map((item) => (
                <article key={item.question}>
                  <h3 className="font-medium">{item.question}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.answer}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 5: Re-run compare route tests**

Run: `pnpm exec vitest run src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/page.test.tsx src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug] apps/web/src/lib/storefront-compare
git commit -m "feat: add crawlable compare pages"
```

---

### Task 4: Add Crawlable Price-Band Decision Pages

**Files:**
- Create: `apps/web/src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/page.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/page.test.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/price-band-page-content.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/price-band-page-content.test.tsx`

- [ ] **Step 1: Write failing price-band route tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateMetadata } from './page';

const mockLoadPriceBandPage = vi.fn();

vi.mock('@/lib/storefront-compare/load-price-band-page', () => ({
  loadPriceBandPage: (...args: unknown[]) => mockLoadPriceBandPage(...args),
}));

const priceBandPageModel = {
  canonicalUrl: 'https://ogabassey.com/smartphones/best-under/under-500k',
  metaTitle: 'Best Smartphones Under ₦500,000 | Ogabassey',
  metaDescription: 'Compare the best smartphones under ₦500,000 from Ogabassey.',
  heading: 'Best Smartphones Under ₦500,000',
  intro: 'These are the strongest smartphone options below the ₦500,000 price band.',
  breadcrumbItems: [
    { name: 'Ogabassey', url: 'https://ogabassey.com' },
    { name: 'Smartphones', url: 'https://ogabassey.com/smartphones' },
    {
      name: 'Best Smartphones Under ₦500,000',
      url: 'https://ogabassey.com/smartphones/best-under/under-500k',
    },
  ],
  products: [
    {
      id: 'product-c',
      slug: 'galaxy-a56',
      name: 'Galaxy A56',
      category: 'Smartphones',
      category_slug: 'smartphones',
      price: 480000,
      image: 'https://cdn.example.com/a56.jpg',
    },
  ],
  isIndexable: true,
  pathPrefix: '',
  payoutCurrency: 'NGN',
};

beforeEach(() => {
  mockLoadPriceBandPage.mockReset();
  mockLoadPriceBandPage.mockResolvedValue(priceBandPageModel);
});

describe('price-band page metadata', () => {
  it('emits canonical metadata for curated price-band pages', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey',
        category: 'smartphones',
        priceBandSlug: 'under-500k',
      }),
    } as never);

    expect(metadata.alternates?.canonical).toContain(
      '/smartphones/best-under/under-500k'
    );
  });
});
```

```tsx
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadPriceBandPage = vi.fn();

vi.mock('@/lib/storefront-compare/load-price-band-page', () => ({
  loadPriceBandPage: (...args: unknown[]) => mockLoadPriceBandPage(...args),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: (value: unknown) => JSON.stringify(value),
}));

const { PriceBandPageContent } = await import('./price-band-page-content');

describe('PriceBandPageContent', () => {
  beforeEach(() => {
    mockLoadPriceBandPage.mockReset();
    mockLoadPriceBandPage.mockResolvedValue(priceBandPageModel);
  });

  it('renders the heading, intro, and product cards', async () => {
    render(
      (await PriceBandPageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          category: 'smartphones',
          priceBandSlug: 'under-500k',
        }),
      })) as ReactElement
    );

    expect(
      screen.getByRole('heading', { name: /Best Smartphones Under ₦500,000/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/These are the strongest smartphone options/i)).toBeInTheDocument();
    expect(screen.getByText('Galaxy A56')).toBeInTheDocument();
  });

  it('renders breadcrumb and ItemList schema scripts', async () => {
    render(
      (await PriceBandPageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          category: 'smartphones',
          priceBandSlug: 'under-500k',
        }),
      })) as ReactElement
    );

    const scripts = Array.from(
      document.querySelectorAll('script[type=\"application/ld+json\"]')
    ).map((script) => JSON.parse(script.textContent || '{}'));

    expect(scripts.some((schema) => schema['@type'] === 'BreadcrumbList')).toBe(true);
    expect(scripts.some((schema) => schema['@type'] === 'ItemList')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/page.test.tsx src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/price-band-page-content.test.tsx`

Expected: FAIL with missing route modules

- [ ] **Step 3: Implement price-band route and content**

```ts
// page.tsx
import { loadPriceBandPage } from '@/lib/storefront-compare/load-price-band-page';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductGridSkeleton } from '@/components/ui/skeletons';
import { PriceBandPageContent } from './price-band-page-content';

export async function generateMetadata({ params }: {
  params: Promise<{ slug: string; category: string; priceBandSlug: string }>;
}) {
  const resolved = await params;
  const page = await loadPriceBandPage({
    merchantSlug: resolved.slug,
    categorySlug: resolved.category,
    priceBandSlug: resolved.priceBandSlug,
  });

  if (!page || !page.isIndexable) notFound();

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: {
      canonical: page.canonicalUrl,
    },
  };
}

export default function PriceBandPage(props: {
  params: Promise<{ slug: string; category: string; priceBandSlug: string }>;
}) {
  return (
    <Suspense fallback={<ProductGridSkeleton count={8} columns={4} />}>
      <PriceBandPageContent {...props} />
    </Suspense>
  );
}
```

```tsx
// price-band-page-content.tsx
import { notFound } from 'next/navigation';
import { ProductIndexCard } from '@/app/(storefront)/[slug]/products/product-index-card';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { buildPriceBandPageSchemas } from '@/lib/storefront-compare/compare-schema';
import { loadPriceBandPage } from '@/lib/storefront-compare/load-price-band-page';

export async function PriceBandPageContent({
  params,
}: {
  params: Promise<{ slug: string; category: string; priceBandSlug: string }>;
}) {
  const resolved = await params;
  const page = await loadPriceBandPage({
    merchantSlug: resolved.slug,
    categorySlug: resolved.category,
    priceBandSlug: resolved.priceBandSlug,
  });

  if (!page || !page.isIndexable) {
    notFound();
  }

  const formatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: page.payoutCurrency,
    maximumFractionDigits: 0,
  });
  const schemas = buildPriceBandPageSchemas({
    breadcrumbItems: page.breadcrumbItems,
    pageName: page.heading,
    pageUrl: page.canonicalUrl,
    currency: page.payoutCurrency,
    products: page.products,
  });

      return (
        <>
          <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
            dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(schemas.breadcrumb) }}
          />
          <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
            dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(schemas.itemList) }}
          />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold">{page.heading}</h1>
        <p className="mt-3 text-base text-muted-foreground">{page.intro}</p>
        <ul role="list" className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {page.products.map((product) => (
            <li key={product.id}>
              <ProductIndexCard
                formattedPrice={formatter.format(product.price)}
                pathPrefix={page.pathPrefix}
                product={product}
              />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Re-run price-band tests**

Run: `pnpm exec vitest run src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/page.test.tsx src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/price-band-page-content.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug] apps/web/src/lib/storefront-compare
git commit -m "feat: add price-band decision pages"
```

---

### Task 5: Wire Internal Links and Sitemap Coverage

**Files:**
- Create: `apps/web/src/lib/storefront-compare/build-commercial-support-links.ts`
- Create: `apps/web/src/lib/storefront-compare/build-commercial-support-links.test.ts`
- Create: `apps/web/src/components/storefront/ogabassey/seo/commercial-support-links.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/seo/commercial-support-links.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/category-page-content.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/product-details-page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/sitemap-data.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/sitemap-data.test.ts`

- [ ] **Step 1: Write failing internal-link and sitemap tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildCategorySupportLinks,
  buildProductSupportLinks,
} from './build-commercial-support-links';

describe('buildCategorySupportLinks', () => {
  it('returns product-compare, brand-compare, and price-band links for eligible categories', () => {
    expect(
      buildCategorySupportLinks({
        storeUrl: 'https://ogabassey.com',
        categorySlug: 'smartphones',
        categoryName: 'Smartphones',
        products: [
          { slug: 'samsung-galaxy-z-trifold', name: 'Samsung Galaxy Z TriFold', brand: 'Samsung', price: 480000, category_slug: 'smartphones', product_key_specs: { chipset: 'Snapdragon 8 Elite', ram_gb: 16, storage_gb: 512 } },
          { slug: 'iphone-17-pro-max', name: 'iPhone 17 Pro Max', brand: 'Apple', price: 495000, category_slug: 'smartphones', product_key_specs: { chipset: 'A19 Pro', ram_gb: 8, storage_gb: 256 } },
          { slug: 'galaxy-a56', name: 'Galaxy A56', brand: 'Samsung', price: 410000, category_slug: 'smartphones', product_key_specs: { chipset: 'Exynos', ram_gb: 8, storage_gb: 128 } },
          { slug: 'galaxy-a36', name: 'Galaxy A36', brand: 'Samsung', price: 360000, category_slug: 'smartphones', product_key_specs: { chipset: 'Snapdragon 7 Gen', ram_gb: 8, storage_gb: 128 } },
          { slug: 'iphone-16e', name: 'iPhone 16e', brand: 'Apple', price: 450000, category_slug: 'smartphones', product_key_specs: { chipset: 'A18', ram_gb: 8, storage_gb: 128 } },
          { slug: 'iphone-15', name: 'iPhone 15', brand: 'Apple', price: 430000, category_slug: 'smartphones', product_key_specs: { chipset: 'A17', ram_gb: 8, storage_gb: 128 } },
        ],
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
        href: 'https://ogabassey.com/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
        }),
        expect.objectContaining({
          href: 'https://ogabassey.com/smartphones/compare/apple-vs-samsung',
        }),
        expect.objectContaining({
          href: 'https://ogabassey.com/smartphones/best-under/under-500k',
        }),
      ])
    );
  });
});

describe('buildProductSupportLinks', () => {
  it('returns compare and price-band links for the current product context', () => {
    expect(
      buildProductSupportLinks({
        storeUrl: 'https://ogabassey.com',
        categorySlug: 'smartphones',
        currentProductSlug: 'iphone-17-pro-max',
        currentProductPrice: 495000,
        products: [
          { slug: 'iphone-17-pro-max', name: 'iPhone 17 Pro Max', brand: 'Apple', price: 495000, category_slug: 'smartphones', product_key_specs: { chipset: 'A19 Pro', ram_gb: 8, storage_gb: 256 } },
          { slug: 'samsung-galaxy-z-trifold', name: 'Samsung Galaxy Z TriFold', brand: 'Samsung', price: 480000, category_slug: 'smartphones', product_key_specs: { chipset: 'Snapdragon 8 Elite', ram_gb: 16, storage_gb: 512 } },
          { slug: 'iphone-16e', name: 'iPhone 16e', brand: 'Apple', price: 450000, category_slug: 'smartphones', product_key_specs: { chipset: 'A18', ram_gb: 8, storage_gb: 128 } },
          { slug: 'iphone-15', name: 'iPhone 15', brand: 'Apple', price: 430000, category_slug: 'smartphones', product_key_specs: { chipset: 'A17', ram_gb: 8, storage_gb: 128 } },
          { slug: 'galaxy-a56', name: 'Galaxy A56', brand: 'Samsung', price: 410000, category_slug: 'smartphones', product_key_specs: { chipset: 'Exynos', ram_gb: 8, storage_gb: 128 } },
          { slug: 'galaxy-a36', name: 'Galaxy A36', brand: 'Samsung', price: 360000, category_slug: 'smartphones', product_key_specs: { chipset: 'Snapdragon 7 Gen', ram_gb: 8, storage_gb: 128 } },
        ],
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
        href: 'https://ogabassey.com/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
        }),
        expect.objectContaining({
          href: 'https://ogabassey.com/smartphones/best-under/under-500k',
        }),
      ])
    );
  });
});
```

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CommercialSupportLinks } from './commercial-support-links';

describe('CommercialSupportLinks', () => {
  it('renders crawlable compare/support links when provided', () => {
    render(
      <CommercialSupportLinks
        heading="Compare and Buying Guides"
        links={[
          {
            href: '/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
            label: 'iPhone 17 Pro Max vs Samsung Galaxy Z TriFold',
          },
        ]}
      />
    );

    expect(
      screen.getByRole('heading', { name: /Compare and Buying Guides/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: /iPhone 17 Pro Max vs Samsung Galaxy Z TriFold/i,
      })
    ).toHaveAttribute(
      'href',
      '/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
    );
  });
});
```

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductDetailsPage } from './product-details-page';

describe('ProductDetailsPage support links', () => {
  it('renders crawlable compare/support links on the Ogabassey PDP', async () => {
    render(
      <ProductDetailsPage
        product={{
          id: 'p-1',
          name: 'Samsung Galaxy Z TriFold',
          price: '₦7,150,000',
          image: 'https://example.com/img.jpg',
          description: 'Foldable flagship',
          condition: 'new' as const,
          colors: [],
          storage: [],
          images: ['https://example.com/img.jpg'],
        }}
        supportLinks={[
          {
            href: '/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
            label: 'iPhone 17 Pro Max vs Samsung Galaxy Z TriFold',
          },
        ]}
      />
    );

    expect(
      await screen.findByRole('link', {
        name: /iPhone 17 Pro Max vs Samsung Galaxy Z TriFold/i,
      })
    ).toBeInTheDocument();
  });
});
```

```tsx
// products/[productSlug]/page.test.tsx
// replace the existing import line with:
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// add these mocks near the existing mock declarations:
const mockBuildProductSupportLinks = vi.fn();
const mockGetCachedCategoryPageData = vi.fn();

// replace the existing cached-data mock with:
vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: (...args: unknown[]) =>
    mockGetRequestScopedMerchant(...args),
  getCachedLegacyProductRedirectTarget: (...args: unknown[]) =>
    mockGetCachedLegacyProductRedirectTarget(...args),
  getCachedProduct: (...args: unknown[]) => mockGetCachedProduct(...args),
  getCachedProductWithDetails: (...args: unknown[]) =>
    mockGetCachedProductWithDetails(...args),
  getCachedProductRatingStats: (...args: unknown[]) =>
    mockGetCachedProductRatingStats(...args),
  getCachedProductReviews: (...args: unknown[]) =>
    mockGetCachedProductReviews(...args),
  getCachedCategoryPageData: (...args: unknown[]) =>
    mockGetCachedCategoryPageData(...args),
  sanitizeLookupLogValue: (value: unknown) =>
    String(value ?? '')
      .replace(/[\r\n\t]/g, '')
      .substring(0, 100),
}));

vi.mock('@/lib/storefront-compare/build-commercial-support-links', async () => {
  const actual = await vi.importActual(
    '@/lib/storefront-compare/build-commercial-support-links'
  );
  return {
    ...actual,
    buildProductSupportLinks: (...args: unknown[]) =>
      mockBuildProductSupportLinks(...args),
  };
});

// append this setup and test inside the existing describe('products/[productSlug] page', ...) block:
beforeEach(() => {
  mockBuildProductSupportLinks.mockReset();
  mockGetCachedCategoryPageData.mockReset();
  mockBuildProductSupportLinks.mockReturnValue([
    {
      href: '/products/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
      label: 'Compare with Samsung Galaxy Z TriFold',
    },
  ]);
});

it('renders compare/support links after the generic PDP route content', async () => {
  mockGetCachedProduct.mockResolvedValue({
    ...uncategorizedProduct,
    slug: 'iphone-17-pro-max',
    name: 'iPhone 17 Pro Max',
  });
  mockGetCachedCategoryPageData.mockResolvedValue({
    isCollection: false,
    fallbackName: 'Products',
    products: [
      {
        slug: 'iphone-17-pro-max',
        name: 'iPhone 17 Pro Max',
        brand: 'Apple',
        price: 495000,
        category_slug: 'products',
        product_key_specs: { chipset: 'A19 Pro', ram_gb: 8, storage_gb: 256 },
      },
      {
        slug: 'samsung-galaxy-z-trifold',
        name: 'Samsung Galaxy Z TriFold',
        brand: 'Samsung',
        price: 480000,
        category_slug: 'products',
        product_key_specs: {
          chipset: 'Snapdragon 8 Elite',
          ram_gb: 16,
          storage_gb: 512,
        },
      },
    ],
  });

  render(
    (await ProductPage({
      params: Promise.resolve({
        slug: 'ogabassey',
        productSlug: 'iphone-17-pro-max',
      }),
      searchParams: Promise.resolve({}),
    })) as ReactElement
  );

  expect(
    screen.getByRole('link', {
      name: /Compare with Samsung Galaxy Z TriFold/i,
    })
  ).toHaveAttribute(
    'href',
    '/products/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
  );
});
```

```tsx
// [category]/[productSlug]/page.test.tsx
// add this missing import at the top of the file:
import type { ReactElement } from 'react';

// add these mocks near the existing mock declarations:
const mockGetCachedCategoryPageData = vi.fn();
const mockBuildProductSupportLinks = vi.fn();

// replace the existing cached-data mock with:
vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: (...args: unknown[]) =>
    mockGetRequestScopedMerchant(...args),
  getCachedLegacyProductRedirectTarget: (...args: unknown[]) =>
    mockGetCachedLegacyProductRedirectTarget(...args),
  getCachedProductWithDetails: (...args: unknown[]) =>
    mockGetCachedProductWithDetails(...args),
  getCachedCategoryPageData: (...args: unknown[]) =>
    mockGetCachedCategoryPageData(...args),
  sanitizeLookupLogValue: (value: unknown) =>
    String(value ?? '')
      .replace(/[\r\n\t]/g, '')
      .substring(0, 100),
}));

// replace the existing ProductDetailsPage mock with:
vi.mock('@/components/storefront/ogabassey/pages/product-details-page', () => ({
  ProductDetailsPage: ({
    product,
    supportLinks = [],
  }: {
    product: { name: string };
    supportLinks?: Array<{ href: string; label: string }>;
  }) => (
    <>
      <h1>{product.name}</h1>
      {supportLinks.map((link) => (
        <a key={link.href} href={link.href}>
          {link.label}
        </a>
      ))}
    </>
  ),
}));

vi.mock('@/lib/storefront-compare/build-commercial-support-links', async () => {
  const actual = await vi.importActual(
    '@/lib/storefront-compare/build-commercial-support-links'
  );
  return {
    ...actual,
    buildProductSupportLinks: (...args: unknown[]) =>
      mockBuildProductSupportLinks(...args),
  };
});

// append this setup and test inside the existing describe('[category]/[productSlug] page render', ...) block:
beforeEach(() => {
  mockGetCachedCategoryPageData.mockReset();
  mockBuildProductSupportLinks.mockReset();
  mockBuildProductSupportLinks.mockReturnValue([
    {
      href: '/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
      label: 'Compare with iPhone 17 Pro Max',
    },
  ]);
});

it('renders compare/support links through the category PDP route', async () => {
  mockGetCachedProductWithDetails.mockResolvedValue({
    ...categorizedDetailedProduct,
    name: 'Samsung Galaxy Z TriFold',
    slug: 'samsung-galaxy-z-trifold',
    brand: 'Samsung',
    category: 'Smartphones',
    categories: {
      id: 'cat-smartphones',
      name: 'Smartphones',
      slug: 'smartphones',
      parent_id: null,
    },
  });
  mockGetCachedCategoryPageData.mockResolvedValue({
    isCollection: false,
    fallbackName: 'Smartphones',
    products: [
      {
        slug: 'samsung-galaxy-z-trifold',
        name: 'Samsung Galaxy Z TriFold',
        brand: 'Samsung',
        price: 480000,
        category_slug: 'smartphones',
        product_key_specs: {
          chipset: 'Snapdragon 8 Elite',
          ram_gb: 16,
          storage_gb: 512,
        },
      },
      {
        slug: 'iphone-17-pro-max',
        name: 'iPhone 17 Pro Max',
        brand: 'Apple',
        price: 495000,
        category_slug: 'smartphones',
        product_key_specs: { chipset: 'A19 Pro', ram_gb: 8, storage_gb: 256 },
      },
    ],
  });

  render(
    (await CategoryProductPage({
      params: Promise.resolve({
        slug: 'ogabassey',
        category: 'smartphones',
        productSlug: 'samsung-galaxy-z-trifold',
      }),
      searchParams: Promise.resolve({}),
    })) as ReactElement
  );

  expect(
    screen.getByRole('link', {
      name: /Compare with iPhone 17 Pro Max/i,
    })
  ).toHaveAttribute(
    'href',
    '/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
  );
});
```

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNamedSitemapEntries,
  getRootSitemapEntries,
  type StorefrontSitemapContext,
} from './sitemap-data';

const mockBuildCommercialSupportLinks = vi.fn();
const mockGetCachedCategoryPageData = vi.fn();

vi.mock('@/lib/storefront-compare/build-commercial-support-links', () => ({
  buildCategorySupportLinks: (...args: unknown[]) =>
    mockBuildCommercialSupportLinks(...args),
  buildProductSupportLinks: (...args: unknown[]) =>
    mockBuildCommercialSupportLinks(...args),
}));

vi.mock('@/lib/cached-data', async () => {
  const actual = await vi.importActual('@/lib/cached-data');
  return {
    ...actual,
    getCachedCategoryPageData: (...args: unknown[]) =>
      mockGetCachedCategoryPageData(...args),
  };
});

describe('storefront sitemap compare/support coverage', () => {
  beforeEach(() => {
    mockBuildCommercialSupportLinks.mockReset();
    mockGetCachedCategoryPageData.mockReset();
    mockBuildCommercialSupportLinks.mockReturnValue([
      {
        href: '/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
        label: 'iPhone 17 Pro Max vs Samsung Galaxy Z TriFold',
      },
    ]);
    mockGetCachedCategoryPageData.mockResolvedValue({
      isCollection: false,
      fallbackName: 'Smartphones',
      products: [
        {
          slug: 'iphone-17-pro-max',
          name: 'iPhone 17 Pro Max',
          brand: 'Apple',
          price: 495000,
        },
        {
          slug: 'samsung-galaxy-z-trifold',
          name: 'Samsung Galaxy Z TriFold',
          brand: 'Samsung',
          price: 480000,
        },
      ],
    });
  });

  it('publishes eligible compare pages through the public sitemap surfaces', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            data: [{ slug: 'smartphones', updated_at: '2026-04-17T00:00:00Z' }],
            error: null,
          }),
        }),
      }),
    } as StorefrontSitemapContext['supabase'];

    const context = {
      merchant: {
        id: 'merchant-1',
        slug: 'ogabassey',
        business_name: 'Ogabassey',
      },
      storeUrl: 'https://ogabassey.com',
      supabase,
    } satisfies StorefrontSitemapContext;
    const namedEntries = await getNamedSitemapEntries(context, 'commercial-support');
    const rootEntries = await getRootSitemapEntries(context);

    expect(
      namedEntries.some((entry) =>
        entry.url.includes('/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold')
      )
    ).toBe(true);
    expect(
      rootEntries.some((entry) =>
        entry.url.includes('/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold')
      )
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/storefront-compare/build-commercial-support-links.test.ts src/components/storefront/ogabassey/seo/commercial-support-links.test.tsx src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx src/components/storefront/ogabassey/pages/product-details-page.test.tsx src/app/(storefront)/[slug]/sitemap-data.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement shared internal-link component**

```tsx
// build-commercial-support-links.ts
import {
  buildProductCompareCandidate,
  buildBrandCompareCandidate,
  buildPriceBandCandidate,
} from './compare-eligibility';
import {
  buildCanonicalBrandCompareSlug,
  buildCanonicalProductCompareSlug,
} from './compare-slugs';
import { CURATED_PRICE_BANDS } from './price-band-taxonomy';

export function buildCategorySupportLinks(input: {
  storeUrl: string;
  categorySlug: string;
  categoryName: string;
  products: Array<{
    slug: string;
    name: string;
    brand?: string | null;
    price: number;
    category_slug?: string | null;
    product_key_specs?: Record<string, unknown> | null;
  }>;
}) {
  const links: Array<{ href: string; label: string }> = [];
  const [first, second] = input.products;
  const productCandidate =
    first && second
      ? buildProductCompareCandidate({
          categorySlug: input.categorySlug,
          leftProduct: first,
          rightProduct: second,
        })
      : null;

  if (first && second && productCandidate?.isIndexable) {
    links.push({
      href: `${input.storeUrl}/${input.categorySlug}/compare/${buildCanonicalProductCompareSlug(first.slug, second.slug)}`,
      label: `${first.name} vs ${second.name}`,
    });
  }

  const brandCounts = new Map<string, number>();
  for (const product of input.products) {
    const brand = product.brand?.trim();
    if (!brand) continue;
    brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);
  }

  const [leftBrandEntry, rightBrandEntry] = [...brandCounts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
  );
  const brandCandidate = buildBrandCompareCandidate({
    categorySlug: input.categorySlug,
    products: input.products,
  });

  if (
    leftBrandEntry &&
    rightBrandEntry &&
    brandCandidate?.isIndexable &&
    brandCandidate.leftBrand === leftBrandEntry[0] &&
    brandCandidate.rightBrand === rightBrandEntry[0]
  ) {
    links.push({
      href: `${input.storeUrl}/${input.categorySlug}/compare/${buildCanonicalBrandCompareSlug(brandCandidate.leftBrand, brandCandidate.rightBrand)}`,
      label: `${brandCandidate.leftBrand} vs ${brandCandidate.rightBrand}`,
    });
  }

  const firstEligibleBand = (CURATED_PRICE_BANDS[input.categorySlug] ?? [])
    .map((band) =>
      buildPriceBandCandidate({
        categorySlug: input.categorySlug,
        band,
        products: input.products,
      })
    )
    .find((candidate) => candidate.isIndexable);

  if (firstEligibleBand) {
    links.push({
      href: `${input.storeUrl}/${input.categorySlug}/best-under/${firstEligibleBand.band.slug}`,
      label: firstEligibleBand.band.label,
    });
  }

  return links;
}

export function buildProductSupportLinks(input: {
  storeUrl: string;
  categorySlug: string;
  currentProductSlug: string;
  currentProductPrice: number;
  products: Array<{
    slug: string;
    name: string;
    brand?: string | null;
    price: number;
    category_slug?: string | null;
    product_key_specs?: Record<string, unknown> | null;
  }>;
}) {
  const links: Array<{ href: string; label: string }> = [];
  const currentProduct = input.products.find(
    (product) => product.slug === input.currentProductSlug
  );
  const productCompareCandidate =
    currentProduct &&
    input.products
      .filter((product) => product.slug !== input.currentProductSlug)
      .map((alternate) => ({
        alternate,
        candidate: buildProductCompareCandidate({
          categorySlug: input.categorySlug,
          leftProduct: currentProduct,
          rightProduct: alternate,
        }),
      }))
      .find((entry) => entry.candidate.isIndexable);

  if (productCompareCandidate) {
    links.push({
      href: `${input.storeUrl}/${input.categorySlug}/compare/${buildCanonicalProductCompareSlug(input.currentProductSlug, productCompareCandidate.alternate.slug)}`,
      label: `Compare with ${productCompareCandidate.alternate.name}`,
    });
  }

  const firstEligibleBand = (CURATED_PRICE_BANDS[input.categorySlug] ?? [])
    .map((band) =>
      buildPriceBandCandidate({
        categorySlug: input.categorySlug,
        band,
        products: input.products,
      })
    )
    .find(
      (candidate) =>
        candidate.isIndexable &&
        input.currentProductPrice <= candidate.band.ceiling &&
        (candidate.band.floor ? input.currentProductPrice > candidate.band.floor : true)
    );

  if (firstEligibleBand) {
    links.push({
      href: `${input.storeUrl}/${input.categorySlug}/best-under/${firstEligibleBand.band.slug}`,
      label: firstEligibleBand.band.label,
    });
  }

  return links;
}
```

```tsx
// commercial-support-links.tsx
import Link from 'next/link';

export function CommercialSupportLinks({
  heading,
  links,
}: {
  heading: string;
  links: Array<{ href: string; label: string }>;
}) {
  if (links.length === 0) return null;

  return (
    <section aria-label={heading}>
      <h2>{heading}</h2>
      <ul>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Wire links into category and PDP surfaces**

```tsx
// category-page-content.tsx
const supportLinks = buildCategorySupportLinks({
  storeUrl: baseUrl,
  categorySlug: category,
  categoryName,
  products: products.map((product) => ({
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    price: product.price,
    category_slug: product.category_slug,
    product_key_specs: product.product_key_specs,
  })),
});

<CommercialSupportLinks
  heading="Compare and Buying Guides"
  links={supportLinks}
/>
```

```tsx
// shared PDP support-link preparation
const resolvedCategorySlug =
  product.category_slug ||
  (product.category ? generateSlug(product.category) : 'products');
const categoryPageData = await getCachedCategoryPageData(
  merchant.id,
  resolvedCategorySlug,
  slug
);
const supportLinks = buildProductSupportLinks({
  storeUrl: baseUrl,
  categorySlug: resolvedCategorySlug,
  currentProductSlug: product.slug,
  currentProductPrice: product.price,
  products: (categoryPageData?.isCollection ? [] : categoryPageData?.products ?? []).map((candidate) => ({
    slug: candidate.slug,
    name: candidate.name,
    brand: candidate.brand,
    price: candidate.price,
    category_slug: candidate.category_slug,
    product_key_specs: candidate.product_key_specs,
  })),
});
```

```tsx
// products/[productSlug]/page.tsx
import { CommercialSupportLinks } from '@/components/storefront/ogabassey/seo/commercial-support-links';

return (
  <>
    <ProductDetailClient product={product} faqs={productFaqs} />
    <CommercialSupportLinks
      heading="Compare and Buying Guides"
      links={supportLinks}
    />
  </>
);
```

```tsx
// [category]/[productSlug]/page.tsx
import { CommercialSupportLinks } from '@/components/storefront/ogabassey/seo/commercial-support-links';

function TemplateProductPage({
  product,
  templateId,
  supportLinks,
}: {
  product: Product;
  templateId?: string;
  supportLinks: Array<{ href: string; label: string }>;
}) {
  if (templateId === 'ogabassey') {
    const ogabasseyProduct = toOgabasseyProduct(product);
    return <OgabasseyProductPage product={ogabasseyProduct} supportLinks={supportLinks} />;
  }

  return (
    <>
      <ProductDetailClient product={product} />
      <CommercialSupportLinks
        heading="Compare and Buying Guides"
        links={supportLinks}
      />
    </>
  );
}

return (
  <TemplateProductPage
    product={product}
    templateId={merchant?.template_id}
    supportLinks={supportLinks}
  />
);
```

```tsx
// components/storefront/ogabassey/pages/product-details-page.tsx
import { CommercialSupportLinks } from '../seo/commercial-support-links';

interface ProductDetailsPageProps {
  product: Product;
  supportLinks?: Array<{ href: string; label: string }>;
}

export function ProductDetailsPage({
  product,
  supportLinks = [],
}: ProductDetailsPageProps) {
  // existing Ogabassey PDP body...
}

<CommercialSupportLinks
  heading="Compare and Buying Guides"
  links={supportLinks}
/>
```

- [ ] **Step 5: Add compare/support sitemap coverage**

```ts
// sitemap-data.ts
import { getCachedCategoryPageData } from '@/lib/cached-data';
import { buildCategorySupportLinks } from '@/lib/storefront-compare/build-commercial-support-links';

export async function getCommercialSupportSitemapEntries(
  context: StorefrontSitemapContext
): Promise<MetadataRoute.Sitemap> {
  const categories = await getCategorySitemapEntries(context);
  const sitemapEntries = await Promise.all(
    categories.map(async (entry) => {
      const categorySlug = entry.url.replace(`${context.storeUrl}/`, '');
      const categoryData = await getCachedCategoryPageData(
        context.merchant.id,
        categorySlug,
        context.merchant.slug
      );
      if (!categoryData || categoryData.isCollection) {
        return [];
      }

      const links = buildCategorySupportLinks({
        storeUrl: context.storeUrl,
        categorySlug,
        categoryName: categoryData.fallbackName || categorySlug,
        products: (categoryData.products ?? []).map((product) => ({
          slug: product.slug,
          name: product.name,
          brand: product.brand,
          price: product.price,
          category_slug: product.category_slug,
          product_key_specs: product.product_key_specs,
        })),
      });

      return links.map((link) => ({
        url: link.href,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    })
  );

  return sitemapEntries.flat();
}

export async function getRootSitemapEntries(
  context: StorefrontSitemapContext
): Promise<MetadataRoute.Sitemap> {
  const [staticEntries, productEntries, categoryEntries, blogEntries, commercialSupportEntries] =
    await Promise.all([
      Promise.resolve(getStaticSitemapEntries(context.storeUrl)),
      getProductSitemapEntries(context),
      getCategorySitemapEntries(context),
      getBlogSitemapEntries(context),
      getCommercialSupportSitemapEntries(context),
    ]);

  return [
    ...staticEntries,
    ...productEntries,
    ...categoryEntries,
    ...blogEntries,
    ...commercialSupportEntries,
  ];
}

export function getNamedSitemapEntries(
  context: StorefrontSitemapContext,
  id: string
): MetadataRoute.Sitemap | Promise<MetadataRoute.Sitemap> {
  switch (id) {
    case 'static':
      return getStaticSitemapEntries(context.storeUrl);
    case 'products':
      return getProductSitemapEntries(context);
    case 'categories':
      return getCategorySitemapEntries(context);
    case 'commercial-support':
      return getCommercialSupportSitemapEntries(context);
    default:
      return [];
  }
}
```

- [ ] **Step 6: Re-run internal-link and sitemap tests**

Run: `pnpm exec vitest run src/lib/storefront-compare/build-commercial-support-links.test.ts src/components/storefront/ogabassey/seo/commercial-support-links.test.tsx src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx src/components/storefront/ogabassey/pages/product-details-page.test.tsx src/app/(storefront)/[slug]/sitemap-data.test.ts`

Expected: PASS

- [ ] **Step 7: Run focused Phase 1 verification**

Run: `pnpm exec vitest run src/lib/storefront-compare src/app/(storefront)/[slug]/[category]/compare src/app/(storefront)/[slug]/[category]/best-under src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx src/app/(storefront)/[slug]/sitemap-data.test.ts`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/storefront-compare/build-commercial-support-links.ts apps/web/src/lib/storefront-compare/build-commercial-support-links.test.ts apps/web/src/components/storefront/ogabassey/seo apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx apps/web/src/components/storefront/ogabassey/pages/product-details-page.test.tsx apps/web/src/app/(storefront)/[slug]/[category]/category-page-content.tsx apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.tsx apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.tsx apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx apps/web/src/app/(storefront)/[slug]/sitemap-data.ts apps/web/src/app/(storefront)/[slug]/sitemap-data.test.ts
git commit -m "feat: wire compare pages into storefront navigation"
```

---

## Self-Review

### Spec coverage

- Compare/support page taxonomy, thresholds, canonicalization, and thin-page guards: Tasks 1-2
- Product-vs-product and brand-vs-brand pages: Task 3
- Price-band decision pages: Task 4
- Internal links from category hubs and PDPs plus sitemap coverage: Task 5

### Placeholder scan

- No TBD/TODO placeholders
- Every task includes concrete file paths, commands, and minimal code shapes

### Type consistency

- `comparisonSlug` is only used for compare routes
- `priceBandSlug` is only used for price-band routes
- Compare/support loaders and schema helpers are centralized under `src/lib/storefront-compare`
