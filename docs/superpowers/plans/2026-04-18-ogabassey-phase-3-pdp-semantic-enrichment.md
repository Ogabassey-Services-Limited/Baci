# Ogabassey Phase 3 PDP Semantic Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Ogabassey PDPs into stronger commercial decision pages by adding server-rendered alternatives, same-brand and same-price decision links, richer category-tied buying context, and tighter outgoing links into the Phase 1 compare/price-band graph and the Phase 2 category hubs.

**Architecture:** Keep both existing PDP routes and enrich them with one shared server-built semantic model instead of inventing new Phase 3 routes. Reuse the Phase 1 compare/price-band helpers and the Phase 2 card UI so the new PDP graph points only at already-canonical destinations. Render the new semantic sections in initial HTML on both the generic PDP route and the Ogabassey category PDP surface, while keeping the existing deferred merchandising widgets as non-SEO enhancement only.

**Tech Stack:** Next.js App Router, React Server Components, existing cached storefront loaders, existing Phase 1 compare helpers, existing Phase 2 card-grid UI, Vitest, Biome, existing product/breadcrumb/FAQ JSON-LD helpers

---

## Constraints

- Phase 3 does **not** add new public routes. It only enriches:
  - `/{slug}/products/{productSlug}`
  - `/{slug}/{category}/{productSlug}`
- Phase 3 does **not** add migrations or dashboard authoring UI.
- Phase 3 must reuse the existing Phase 1 public destinations:
  - product-vs-product compare pages
  - brand-vs-brand compare pages
  - price-band pages
- Phase 3 must reuse the Phase 2 category hub route as the main category-level commercial destination.
- In this phase, “same-brand” and “same-price” decision pages mean:
  - existing PDP URLs for adjacent products
  - existing compare pages
  - existing price-band pages
  Phase 3 does **not** introduce new standalone brand-only route architecture.
- Phase 3 must not depend on runtime AI copy generation. All copy must be deterministic from:
  - current product data
  - category inventory data
  - bounded category support defaults
- The new semantic modules must render in the initial HTML for both PDP surfaces.
- Do **not** move new SEO-bearing modules into the deferred `BrandProducts`, `PriceRangeProducts`, or `BlogSnippet` widgets. Those stay enhancement-only.
- Do **not** grow these already-large files with more inline logic than necessary:
  - `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.tsx`
  - `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.tsx`
  - `apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx`
- Preserve existing Product, Breadcrumb, and FAQ JSON-LD output. Phase 3 must not create duplicate schema objects.

---

## File Map

### Create

- `apps/web/src/config/product-semantic-support.ts`
  - Bounded category-specific headings and buying-context defaults for PDP semantic sections.
- `apps/web/src/lib/storefront-product/product-semantic-types.ts`
  - Shared Phase 3 types for cards, sections, trust bullets, and the full PDP semantic model.
- `apps/web/src/lib/storefront-product/build-product-semantic-model.ts`
  - Shared server helper that derives the full PDP semantic model from the current product, category inventory, and request-scoped store URL.
- `apps/web/src/lib/storefront-product/build-product-semantic-model.test.ts`
- `apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.tsx`
  - Server-rendered PDP semantic block that reuses the Phase 2 card grid and the existing compare/support link list.
- `apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx`

### Modify

- `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.tsx`
  - Build the Phase 3 semantic model and render it in initial HTML on the generic PDP route.
- `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx`
- `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.tsx`
  - Build the same semantic model and pass it into the Ogabassey template path.
- `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx`
- `apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx`
  - Accept a server-rendered semantic slot and place it before the deferred merchandising shell.
- `apps/web/src/components/storefront/ogabassey/pages/product-details-page.test.tsx`

### Reuse Without Modification

- `apps/web/src/lib/storefront-compare/build-commercial-support-links.ts`
- `apps/web/src/lib/storefront-compare/compare-eligibility.ts`
- `apps/web/src/lib/storefront-compare/compare-slugs.ts`
- `apps/web/src/components/storefront/ogabassey/seo/category-hub-card-grid.tsx`
- `apps/web/src/components/storefront/ogabassey/seo/commercial-support-links.tsx`

---

## Shared Data Contract

`buildProductSemanticModel(input)` must return this exact shape:

```ts
import type { CommercialSupportLink } from '@/lib/storefront-compare/build-commercial-support-links';

export interface ProductSemanticCard {
  title: string;
  description: string;
  href: string;
  eyebrow?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export interface ProductSemanticSection {
  heading: string;
  cards: ProductSemanticCard[];
}

export interface ProductSemanticModel {
  trustBullets: string[];
  supportLinks: CommercialSupportLink[];
  alternatives: ProductSemanticSection | null;
  sameBrand: ProductSemanticSection | null;
  samePrice: ProductSemanticSection | null;
}
```

### Input contract

`buildProductSemanticModel(input)` must accept:

```ts
interface ProductSemanticCandidate {
  slug: string;
  name: string;
  brand?: string | null;
  price: number;
  condition?: string | null;
  category_slug?: string | null;
  product_key_specs?: Record<string, unknown> | null;
}

interface BuildProductSemanticModelInput {
  storeUrl: string;
  merchantBusinessName: string;
  categorySlug: string;
  categoryName: string;
  currentProduct: ProductSemanticCandidate;
  inventory: ProductSemanticCandidate[];
}
```

### Link rules

- `supportLinks` must always start with the category hub link:
  - `href: ${storeUrl}/${categorySlug}`
  - `label: Shop more {categoryName}`
- After the category hub link, append the existing `buildProductSupportLinks(...)` output.
- De-duplicate `supportLinks` by `href`.
- Do not emit any support link that points back to the current PDP.

### Alternatives rules

- `alternatives` must contain up to 3 same-category products excluding the current product.
- Ranking must be deterministic:
  1. same condition bucket as the current product
  2. in-stock before out-of-stock
  3. absolute price distance ascending
  4. greater key-spec overlap before lower overlap
  5. slug ascending
- Each alternative card may expose an optional compare CTA only when `buildProductCompareCandidate(...)` marks the pair indexable.

### Same-brand rules

- `sameBrand` must contain up to 3 products from the same brand and same category, excluding the current product.
- `href` is always the canonical public PDP URL for that product:
  - `/${category_slug}/${slug}` when `category_slug` exists
  - `/products/${slug}` when `category_slug` is absent
- `secondaryHref` / `secondaryLabel` are only present when a direct product-vs-product compare page is indexable for the current product and that candidate.
- If the current product has no brand, `sameBrand` must be `null`.

### Same-price rules

- `samePrice` must contain up to 3 same-category products excluding the current product.
- Ranking must prefer products in the same curated price band first.
- If no same-band products exist, fall back to products within a bounded `±20%` price window.
- Within the selected pool, ranking must be deterministic:
  1. different brand before same brand
  2. in-stock before out-of-stock
  3. absolute price distance ascending
  4. slug ascending
- Same-price cards may also expose the optional compare CTA when direct compare is indexable.

### Trust-bullet rules

- `trustBullets` must be deterministic and bounded to facts supported by current data.
- Build them only from:
  - current product condition
  - presence of condition offers
  - presence of variant axes / options
  - price-band membership
  - category-specific support defaults
- Never emit unsupported claims such as warranty, returns, or delivery promises unless the current PDP data already contains the backing source. This phase should not invent new merchant-service claims.

### Empty-state rules

- If a section has zero cards, return `null` for that section instead of rendering an empty wrapper.
- If inventory is missing or collection-shaped, `supportLinks` may degrade to only the category hub link, and the card sections may be `null`.

---

## Task 1: Build the Shared PDP Semantic Model

**Files:**
- Create: `apps/web/src/config/product-semantic-support.ts`
- Create: `apps/web/src/lib/storefront-product/product-semantic-types.ts`
- Create: `apps/web/src/lib/storefront-product/build-product-semantic-model.ts`
- Test: `apps/web/src/lib/storefront-product/build-product-semantic-model.test.ts`

- [ ] **Step 1: Write the failing semantic-model tests**

Add tests that prove all of the following:

- the category hub link is always first in `supportLinks`
- existing `buildProductSupportLinks(...)` output is appended after the category hub link without duplicate `href`s
- `alternatives` excludes the current product and ranks deterministically by condition, stock, price distance, spec overlap, then slug
- `sameBrand` is `null` when the current product has no brand
- `sameBrand` cards use PDP `href`s and only expose compare CTAs when the pair is indexable
- `samePrice` prefers same curated price-band candidates before the fallback `±20%` window
- `samePrice` prefers different-brand options before same-brand ones
- `trustBullets` stay bounded to deterministic facts and do not emit unsupported service promises
- missing inventory produces only the category hub link and `null` card sections

Use this exact test scaffold:

```ts
import { describe, expect, it } from 'vitest';
import { buildProductSemanticModel } from './build-product-semantic-model';

describe('buildProductSemanticModel', () => {
  it('keeps the category hub link first and appends compare support links without duplicates', () => {
    // arrange currentProduct + inventory
    const model = buildProductSemanticModel({
      storeUrl: 'https://ogabassey.com',
      merchantBusinessName: 'Ogabassey',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      currentProduct,
      inventory,
    });

    expect(model.supportLinks[0]).toEqual({
      href: 'https://ogabassey.com/smartphones',
      label: 'Shop more Smartphones',
    });
    expect(new Set(model.supportLinks.map((link) => link.href)).size).toBe(
      model.supportLinks.length,
    );
  });

  it('returns deterministic same-brand and same-price cards with optional compare CTAs', () => {
    const model = buildProductSemanticModel(input);

    expect(model.sameBrand?.cards[0].href).toBe(
      'https://ogabassey.com/smartphones/samsung-galaxy-s25',
    );
    expect(model.samePrice?.cards[0].secondaryLabel).toMatch(/Compare with/i);
  });
});
```

- [ ] **Step 2: Run the model test to verify it fails**

Run:

`pnpm exec vitest run src/lib/storefront-product/build-product-semantic-model.test.ts`

Expected:

- FAIL with missing module errors for the new Phase 3 files

- [ ] **Step 3: Implement the shared config, types, and model**

Add `product-semantic-support.ts` with bounded category defaults:

```ts
export const PRODUCT_SEMANTIC_SUPPORT = {
  default: {
    alternativesHeading: 'Similar options to consider',
    sameBrandHeading: 'More from this brand',
    samePriceHeading: 'More in this price range',
    trustBulletPrefix: 'Buying context',
  },
  smartphones: {
    alternativesHeading: 'Alternative phones to compare',
    sameBrandHeading: 'More phones from this brand',
    samePriceHeading: 'More phones in this price range',
  },
  laptops: {
    alternativesHeading: 'Alternative laptops to compare',
    sameBrandHeading: 'More laptops from this brand',
    samePriceHeading: 'More laptops in this price range',
  },
  'smart-tvs': {
    alternativesHeading: 'Alternative TVs to compare',
    sameBrandHeading: 'More TVs from this brand',
    samePriceHeading: 'More TVs in this price range',
  },
} as const;
```

Implement the model builder with explicit helpers:

```ts
function buildCategoryHubLink(input: BuildProductSemanticModelInput): CommercialSupportLink {
  return {
    href: `${input.storeUrl}/${input.categorySlug}`,
    label: `Shop more ${input.categoryName}`,
  };
}

function buildDirectCompareCta(input: {
  storeUrl: string;
  categorySlug: string;
  currentProduct: ProductSemanticCandidate;
  candidate: ProductSemanticCandidate;
}) {
  const compareCandidate = buildProductCompareCandidate({
    categorySlug: input.categorySlug,
    leftProduct: input.currentProduct,
    rightProduct: input.candidate,
  });

  if (!compareCandidate.isIndexable) {
    return {};
  }

  return {
    secondaryHref: `${input.storeUrl}/${input.categorySlug}/compare/${buildCanonicalProductCompareSlug(input.currentProduct.slug, input.candidate.slug)}`,
    secondaryLabel: `Compare with ${input.candidate.name}`,
  };
}
```

And return the final shape from one pure function:

```ts
export function buildProductSemanticModel(
  input: BuildProductSemanticModelInput,
): ProductSemanticModel {
  const supportLinks = dedupeLinks([
    buildCategoryHubLink(input),
    ...buildProductSupportLinks({
      storeUrl: input.storeUrl,
      categorySlug: input.categorySlug,
      currentProductSlug: input.currentProduct.slug,
      currentProductPrice: input.currentProduct.price,
      products: input.inventory,
    }),
  ]);

  return {
    trustBullets: buildTrustBullets(input),
    supportLinks,
    alternatives: buildAlternativesSection(input),
    sameBrand: buildSameBrandSection(input),
    samePrice: buildSamePriceSection(input),
  };
}
```

- [ ] **Step 4: Run the model test to verify it passes**

Run:

`pnpm exec vitest run src/lib/storefront-product/build-product-semantic-model.test.ts`

Expected:

- PASS with all semantic-model tests green

- [ ] **Step 5: Commit Task 1**

```bash
git add apps/web/src/config/product-semantic-support.ts \
  apps/web/src/lib/storefront-product/product-semantic-types.ts \
  apps/web/src/lib/storefront-product/build-product-semantic-model.ts \
  apps/web/src/lib/storefront-product/build-product-semantic-model.test.ts
git commit -m "feat: add PDP semantic model"
```

---

## Task 2: Build the Server-Rendered PDP Semantic Sections UI

**Files:**
- Create: `apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.tsx`
- Test: `apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx`

- [ ] **Step 1: Write the failing render tests**

Add tests that prove:

- trust bullets render when present
- `alternatives`, `sameBrand`, and `samePrice` each reuse the existing `CategoryHubCardGrid`
- `supportLinks` render through the existing `CommercialSupportLinks`
- empty sections do not render wrappers

Use this exact test scaffold:

```tsx
import { render, screen } from '@testing-library/react';
import { ProductSemanticSections } from './product-semantic-sections';

it('renders trust bullets, card sections, and support links', () => {
  render(
    <ProductSemanticSections
      model={{
        trustBullets: ['Available in New condition', 'More options in this price band'],
        supportLinks: [{ href: '/smartphones', label: 'Shop more Smartphones' }],
        alternatives: {
          heading: 'Alternative phones to compare',
          cards: [{ title: 'iPhone 17 Air', description: 'Closer in price', href: '/smartphones/iphone-17-air' }],
        },
        sameBrand: null,
        samePrice: null,
      }}
    />,
  );

  expect(screen.getByText('Available in New condition')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Shop more Smartphones' })).toBeInTheDocument();
  expect(screen.getByText('Alternative phones to compare')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the UI test to verify it fails**

Run:

`pnpm exec vitest run src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx`

Expected:

- FAIL with missing module errors for `product-semantic-sections.tsx`

- [ ] **Step 3: Implement the semantic sections component**

Compose existing UI instead of inventing a new card grid:

```tsx
import { CategoryHubCardGrid } from './category-hub-card-grid';
import { CommercialSupportLinks } from './commercial-support-links';
import type { ProductSemanticModel } from '@/lib/storefront-product/product-semantic-types';

export function ProductSemanticSections({
  model,
}: {
  model: ProductSemanticModel;
}) {
  const hasCards =
    model.alternatives || model.sameBrand || model.samePrice;

  if (!model.trustBullets.length && !model.supportLinks.length && !hasCards) {
    return null;
  }

  return (
    <section className="mt-10 border-t border-[color:color-mix(in_srgb,var(--store-background-text,#111827)_12%,transparent)] pt-8">
      {model.trustBullets.length > 0 ? (
        <ul className="mb-8 space-y-2">
          {model.trustBullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      {model.alternatives ? (
        <CategoryHubCardGrid
          title={model.alternatives.heading}
          cards={model.alternatives.cards}
        />
      ) : null}
      {model.sameBrand ? (
        <CategoryHubCardGrid
          title={model.sameBrand.heading}
          cards={model.sameBrand.cards}
        />
      ) : null}
      {model.samePrice ? (
        <CategoryHubCardGrid
          title={model.samePrice.heading}
          cards={model.samePrice.cards}
        />
      ) : null}
      <CommercialSupportLinks
        heading="Compare and Buying Guides"
        links={model.supportLinks}
      />
    </section>
  );
}
```

- [ ] **Step 4: Run the UI test to verify it passes**

Run:

`pnpm exec vitest run src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx`

Expected:

- PASS with the new semantic-section render tests green

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.tsx \
  apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx
git commit -m "feat: add PDP semantic sections UI"
```

---

## Task 3: Wire the Generic PDP Route to the Shared Semantic Model

**Files:**
- Modify: `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.tsx`
- Test: `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx`

- [ ] **Step 1: Write the failing generic-route tests**

Add tests that prove:

- the route builds the semantic model from the current product + category inventory
- the rendered HTML includes:
  - the category hub link
  - at least one compare/support link when the helper returns one
- the route passes the request-scoped store URL into the model builder
- the route no longer renders a standalone `CommercialSupportLinks` block outside the shared semantic sections

Use this exact test shape:

```tsx
const mockBuildProductSemanticModel = vi.fn();

vi.mock('@/lib/storefront-product/build-product-semantic-model', () => ({
  buildProductSemanticModel: (...args: unknown[]) =>
    mockBuildProductSemanticModel(...args),
}));

it('renders server semantic sections on the generic PDP route', async () => {
  mockBuildProductSemanticModel.mockReturnValue({
    trustBullets: ['Available in New condition'],
    supportLinks: [
      { href: 'https://teststore.usebaci.com/smartphones', label: 'Shop more Smartphones' },
      { href: 'https://teststore.usebaci.com/smartphones/compare/iphone-15-vs-galaxy-s25', label: 'Compare with Galaxy S25' },
    ],
    alternatives: null,
    sameBrand: null,
    samePrice: null,
  });

  render(await ProductPage({
    params: Promise.resolve({ slug: 'teststore', productSlug: 'iphone-15' }),
    searchParams: Promise.resolve({}),
  }));

  expect(screen.getByRole('link', { name: 'Shop more Smartphones' })).toBeInTheDocument();
  expect(mockBuildProductSemanticModel).toHaveBeenCalledWith(
    expect.objectContaining({
      storeUrl: 'https://teststore.usebaci.com',
      categorySlug: 'phones',
    }),
  );
});
```

- [ ] **Step 2: Run the generic-route test to verify it fails**

Run:

`pnpm exec vitest run 'src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx'`

Expected:

- FAIL because `buildProductSemanticModel(...)` is not wired
- FAIL because the route still renders the legacy standalone support-links footer

- [ ] **Step 3: Implement the generic-route wiring**

In `page.test.tsx`, replace the current render-path support-links test (`it('renders compare/support links after the generic PDP route content', ...)`) instead of appending a second render test. Update the top mock block to include:

```tsx
const mockBuildProductSemanticModel = vi.fn();

vi.mock('@/lib/storefront-product/build-product-semantic-model', () => ({
  buildProductSemanticModel: (...args: unknown[]) =>
    mockBuildProductSemanticModel(...args),
}));
```

In `page.tsx`, replace the ad-hoc support-link footer flow with the shared model:

```tsx
import { ProductSemanticSections } from '@/components/storefront/ogabassey/seo/product-semantic-sections';
import { buildProductSemanticModel } from '@/lib/storefront-product/build-product-semantic-model';

const inventoryCandidates = (categoryPageData?.isCollection
  ? []
  : (categoryPageData?.products ?? [])
).map((candidate) => {
  const productCandidate = candidate as {
    slug: string;
    name: string;
    brand?: string | null;
    price: number;
    condition?: string | null;
    category_slug?: string | null;
    product_key_specs?: Record<string, unknown> | null;
  };

  return {
    slug: productCandidate.slug,
    name: productCandidate.name,
    brand: productCandidate.brand,
    price: productCandidate.price,
    condition: productCandidate.condition,
    category_slug: productCandidate.category_slug,
    product_key_specs: productCandidate.product_key_specs,
  };
});

const semanticModel = buildProductSemanticModel({
  storeUrl: baseUrl,
  merchantBusinessName: merchant.business_name || 'Baci Store',
  categorySlug,
  categoryName,
  currentProduct: {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    price: product.price,
    condition: product.condition,
    category_slug: product.category_slug,
    product_key_specs: product.product_key_specs,
  },
  inventory: inventoryCandidates,
});
```

And render it in the route shell:

```tsx
<Suspense fallback={<ProductDetailSkeleton />}>
  <ProductDetailClient product={product} faqs={productFaqs} />
  <ProductSemanticSections model={semanticModel} />
</Suspense>
```

Do **not** modify `product-detail-client.tsx` in this task. The generic semantic section stays route-level.

- [ ] **Step 4: Run the generic-route test to verify it passes**

Run:

`pnpm exec vitest run 'src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx'`

Expected:

- PASS with the generic-route semantic-section assertions green

- [ ] **Step 5: Commit Task 3**

```bash
git add 'apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.tsx' \
  'apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx'
git commit -m "feat: wire semantic sections into generic PDP route"
```

---

## Task 4: Wire the Category PDP Route and Ogabassey Template Placement

**Files:**
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/product-details-page.test.tsx`

- [ ] **Step 1: Write the failing category-route and Ogabassey-template tests**

Add tests that prove:

- the category PDP route builds the same semantic model with the resolved category slug
- the Ogabassey template receives a semantic slot and renders it before the deferred merchandising shell
- semantic links remain present when deferred content has not mounted yet

Use this exact test scaffold in `product-details-page.test.tsx`:

```tsx
it('renders a server semantic slot before deferred merchandising content', () => {
  shouldRenderDeferredShellChildren = false;

  render(
    <ProductDetailsPage
      product={product}
      semanticSections={
        <div>
          <a href="/smartphones">Shop more Smartphones</a>
        </div>
      }
    />,
  );

  expect(
    screen.getByRole('link', { name: 'Shop more Smartphones' }),
  ).toBeInTheDocument();
});
```

And in the route test:

```tsx
import type { ReactNode } from 'react';

vi.mock('@/components/storefront/ogabassey/pages/product-details-page', () => ({
  ProductDetailsPage: ({
    product,
    semanticSections = null,
  }: {
    product: { name: string };
    semanticSections?: ReactNode;
  }) => (
    <>
      <h1>{product.name}</h1>
      {semanticSections}
    </>
  ),
}));

const mockBuildProductSemanticModel = vi.fn();

vi.mock('@/lib/storefront-product/build-product-semantic-model', () => ({
  buildProductSemanticModel: (...args: unknown[]) =>
    mockBuildProductSemanticModel(...args),
}));

it('passes the shared semantic sections into the Ogabassey PDP surface', async () => {
  mockBuildProductSemanticModel.mockReturnValue({
    trustBullets: [],
    supportLinks: [{ href: 'https://teststore.usebaci.com/smartphones', label: 'Shop more Smartphones' }],
    alternatives: null,
    sameBrand: null,
    samePrice: null,
  });

  render(await CategoryProductPage({
    params: Promise.resolve({
      slug: 'teststore',
      category: 'smartphones',
      productSlug: 'samsung-galaxy-z-trifold',
    }),
    searchParams: Promise.resolve({}),
  }));

  expect(screen.getByRole('link', { name: 'Shop more Smartphones' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the category-route and template tests to verify they fail**

Run:

`pnpm exec vitest run 'src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx' src/components/storefront/ogabassey/pages/product-details-page.test.tsx`

Expected:

- FAIL because `ProductDetailsPage` does not yet accept the semantic slot
- FAIL because the category PDP route does not yet build or pass the shared semantic model

- [ ] **Step 3: Implement the Ogabassey placement and category-route wiring**

In `page.test.tsx`, replace the existing `ProductDetailsPage` mock at the top of the file so it renders `semanticSections` instead of `supportLinks`. Do not append a second competing mock.

In that same route test file, replace the existing render-path support-links test (`it('renders compare/support links through the category PDP route', ...)`) instead of appending a second route render test. Reuse that test's smartphone product override and `getCachedCategoryPageData(...)` smartphone fixture so the route stays on the render path instead of falling back to the suite's default laptop fixture.

At the top of `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx`, add:

```tsx
import type { ReactNode } from 'react';
```

First, add the slot prop to `product-details-page.tsx`:

```tsx
import type { ReactNode } from 'react';

interface ProductDetailsPageProps {
  product: Product;
  semanticSections?: ReactNode;
}
```

Render it before the deferred merchandising shell:

```tsx
{semanticSections}

<DeferredShellFeature fallback={deferredDetailsFallback} timeoutMs={1800}>
  {/* existing ProductDetailsTabs / BlogSnippet / BrandProducts / PriceRangeProducts */}
</DeferredShellFeature>
```

Then build the shared model in the category PDP route and pass the server-rendered node through `TemplateProductPage(...)`:

```tsx
import type { ReactNode } from 'react';

const semanticSections = <ProductSemanticSections model={semanticModel} />;

<TemplateProductPage
  product={product}
  semanticSections={semanticSections}
  templateId={merchant?.template_id}
/>
```

And update the template function:

```tsx
function TemplateProductPage({
  product,
  templateId,
  semanticSections,
}: {
  product: Product;
  templateId?: string;
  semanticSections: ReactNode;
}) {
  if (templateId === 'ogabassey') {
    return (
      <OgabasseyProductPage
        product={toOgabasseyProduct(product)}
        semanticSections={semanticSections}
      />
    );
  }

  return (
    <>
      <ProductDetailClient product={product} />
      {semanticSections}
    </>
  );
}
```

After this change, remove both legacy support-link render paths:

- the old `CommercialSupportLinks` block inside `product-details-page.tsx`
- the old standalone route-level `CommercialSupportLinks` rendering from the category PDP route

The shared semantic component is the only SEO-bearing block.

- [ ] **Step 4: Run the category-route and template tests to verify they pass**

Run:

`pnpm exec vitest run 'src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx' src/components/storefront/ogabassey/pages/product-details-page.test.tsx`

Expected:

- PASS with the category-route and template-slot assertions green

- [ ] **Step 5: Commit Task 4**

```bash
git add 'apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.tsx' \
  'apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx' \
  apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx \
  apps/web/src/components/storefront/ogabassey/pages/product-details-page.test.tsx
git commit -m "feat: render semantic sections on category PDPs"
```

---

## Task 5: Focused Phase 3 Verification and Cleanup

**Files:**
- Modify only as required by verification failures from Tasks 1-4

- [ ] **Step 1: Run the focused Phase 3 test suite**

Run:

```bash
pnpm exec vitest run \
  src/lib/storefront-product/build-product-semantic-model.test.ts \
  src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx \
  'src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx' \
  'src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx' \
  src/components/storefront/ogabassey/pages/product-details-page.test.tsx
```

Expected:

- PASS with all Phase 3-focused tests green

- [ ] **Step 2: Run the scoped lint check**

Run:

```bash
pnpm exec biome check \
  src/config/product-semantic-support.ts \
  src/lib/storefront-product/product-semantic-types.ts \
  src/lib/storefront-product/build-product-semantic-model.ts \
  src/lib/storefront-product/build-product-semantic-model.test.ts \
  src/components/storefront/ogabassey/seo/product-semantic-sections.tsx \
  src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx \
  'src/app/(storefront)/[slug]/products/[productSlug]/page.tsx' \
  'src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx' \
  'src/app/(storefront)/[slug]/[category]/[productSlug]/page.tsx' \
  'src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx' \
  src/components/storefront/ogabassey/pages/product-details-page.tsx \
  src/components/storefront/ogabassey/pages/product-details-page.test.tsx
```

Expected:

- PASS with no new Biome errors

- [ ] **Step 3: Run the full web lint gate**

Run:

`pnpm turbo lint --filter=@baci/web`

Expected:

- PASS
- pre-existing unrelated warnings may remain, but Phase 3 must not introduce new warnings

- [ ] **Step 4: Commit any verification-driven cleanup**

```bash
git add apps/web/src/config/product-semantic-support.ts \
  apps/web/src/lib/storefront-product/product-semantic-types.ts \
  apps/web/src/lib/storefront-product/build-product-semantic-model.ts \
  apps/web/src/lib/storefront-product/build-product-semantic-model.test.ts \
  apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.tsx \
  apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx \
  'apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.tsx' \
  'apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx' \
  'apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.tsx' \
  'apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx' \
  apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx \
  apps/web/src/components/storefront/ogabassey/pages/product-details-page.test.tsx
git commit -m "feat: enrich Ogabassey PDP semantic graph"
```

---

## Self-Review

### Spec coverage

- Phase 3 explicit alternatives block:
  - covered by Task 1 model + Task 2 UI + Tasks 3-4 route wiring
- links to nearest compare pages:
  - covered by `supportLinks` and optional card compare CTAs in Task 1
- links to same-brand and same-price decision pages:
  - covered by `sameBrand` and `samePrice` PDP card sections in Task 1 + Task 2
- stronger trust/buying context modules:
  - covered by `trustBullets` in Task 1 + Task 2
- semantic support sections tied to category:
  - covered by category hub link first, category support defaults, and route wiring in Tasks 1-4
- emphasis on crawlable outgoing relationships, not only UI:
  - covered by route-level/server-rendered placement in Tasks 3-4

### Placeholder scan

- No `TODO`, `TBD`, ellipses, or implicit “write tests” placeholders remain.
- Every code-changing step includes concrete code or a concrete wiring target.

### Type consistency

- `ProductSemanticModel`, `ProductSemanticSection`, and `ProductSemanticCard` are defined once in Task 1 and reused consistently in Tasks 2-4.
- `semanticSections` is the only new prop added to `ProductDetailsPage`, and later tasks use the same prop name consistently.
