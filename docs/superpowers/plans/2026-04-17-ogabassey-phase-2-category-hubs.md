# Ogabassey Phase 2 Category Hub Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the highest-value Ogabassey category pages into stronger commercial landing pages with structured intro copy, “best for” decision cards, brand highlights, price-band decision links, compare/support links, and stronger FAQ coverage.

**Architecture:** Keep one canonical URL per category hub and enrich the existing `/{slug}/{category}` route instead of adding new Phase 2 routes. Resolve hub content on the server from existing merchant-authored category SEO fields first, then curated defaults for the priority categories, then a tightly bounded computed fallback. Reuse the Phase 1 compare and price-band eligibility helpers so hub links only point at pages that are already eligible to index. Extract the new hub UI into dedicated components instead of growing the existing oversized Ogabassey category page further.

**Tech Stack:** Next.js App Router, React Server Components, existing cached storefront loaders, Vitest, existing `product_key_specs` and Phase 1 compare utilities, existing JSON-LD helpers in `seo-utils.ts`

---

## Constraints

- Phase 2 does **not** add new public routes. It only enriches existing category pages.
- Phase 2 does **not** add a migration or dashboard CMS UI. Merchant-authored input comes only from the existing category SEO fields:
  - `seo_heading`
  - `seo_description`
  - `seo_features`
  - `seo_faq`
- Curated hub modules only ship for:
  - `smartphones`
  - `laptops`
  - `smart-tvs`
- Non-priority categories still get a valid intro/features/FAQ experience, but they must not sprout vague generated “best for” or brand/price-band blocks.
- Category hub links must only point at compare/price-band pages that the existing Phase 1 eligibility helpers mark as indexable.
- Do not add more SEO JSX into `apps/web/src/components/storefront/ogabassey/pages/category-page.tsx`. That file is already too large; Phase 2 must extract.

---

## File Map

### Create

- `apps/web/src/config/category-hub-defaults.ts`
  - Curated category-hub copy and section definitions for `smartphones`, `laptops`, and `smart-tvs`.
- `apps/web/src/lib/storefront-category/category-hub-types.ts`
  - Shared hub-model types for intro copy, card sections, section-source metadata, and FAQ items.
- `apps/web/src/lib/storefront-category/build-category-hub-model.ts`
  - Shared server helper that resolves source precedence and builds the final category hub model from merchant/category/product data.
- `apps/web/src/lib/storefront-category/build-category-hub-model.test.ts`
- `apps/web/src/components/storefront/ogabassey/seo/category-hub-card-grid.tsx`
  - Reusable themed card grid for best-for, brand, and price-band sections.
- `apps/web/src/components/storefront/ogabassey/seo/category-hub-card-grid.test.tsx`
- `apps/web/src/components/storefront/ogabassey/seo/category-hub-sections.tsx`
  - The extracted category hub footer/body content block for intro, trust features, decision cards, compare links, and FAQ.
- `apps/web/src/components/storefront/ogabassey/seo/category-hub-sections.test.tsx`

### Modify

- `apps/web/src/lib/cached-data.ts`
  - Extend category-page product selection with `product_key_specs` so hub heuristics can run from cached category data.
- `apps/web/src/lib/cached-data.products.test.ts`
  - Cover the widened category-page query shape.
- `apps/web/src/lib/normalize-product.ts`
  - Preserve `product_key_specs` on normalized category products.
- `apps/web/src/lib/normalize-product.test.ts`
- `apps/web/src/app/(storefront)/[slug]/[category]/page.tsx`
  - Replace duplicated category SEO resolution with the shared category hub model for metadata.
- `apps/web/src/app/(storefront)/[slug]/[category]/category-page-content.tsx`
  - Build the shared hub model once on the server and pass it to the Ogabassey category page.
- `apps/web/src/app/(storefront)/[slug]/[category]/page.test.tsx`
  - Cover metadata and rendered hub sections from the shared model.
- `apps/web/src/components/storefront/ogabassey/pages/category-page.tsx`
  - Remove inline SEO/footer markup and render the extracted hub sections component.
- `apps/web/src/components/storefront/ogabassey/pages/category-page.test.tsx`
  - Preserve pagination/filter behavior while covering hub-section rendering.

---

## Shared Data Contract

`buildCategoryHubModel(input)` must return this concrete shape:

```ts
interface CategoryHubModel {
  intro: {
    heading: string;
    description: string;
    source: 'merchant' | 'curated' | 'fallback';
  };
  trustFeatures: string[];
  bestForCards: CategoryHubCard[];
  brandCards: CategoryHubCard[];
  priceBandCards: CategoryHubCard[];
  comparisonLinks: {
    href: string;
    label: string;
  }[];
  faqItems: {
    question: string;
    answer: string;
  }[];
}

interface CategoryHubCard {
  title: string;
  description: string;
  href: string;
  eyebrow?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}
```

### Source precedence

`intro`, `trustFeatures`, and `faqItems` resolve in this order:

1. merchant-authored category SEO fields when present
2. curated defaults from `category-hub-defaults.ts` for priority categories
3. bounded computed fallback only for intro copy on non-priority categories

### Collection-page rules

When `getCachedCategoryPageData(...)` returns `isCollection: true`:

- `buildCategoryHubModel(...)` must preserve the existing collection `data.seo` intro/metadata payload as the hub intro/features/FAQ source
- `bestForCards` must be `[]`
- `brandCards` must be `[]`
- `priceBandCards` must be `[]`
- `comparisonLinks` must be `[]`
- Phase 2 must not apply non-priority fallback intro logic or priority-category heuristics to:
  - `new-arrivals`
  - `best-sellers`
  - `on-sale`
  - `featured`

### Fallback rules

- The fallback intro must be one short commercial paragraph built from:
  - category name
  - merchant business name
  - active product count
  - up to 3 top brands
- The fallback intro must never invent unsupported claims.
- Fallback must not generate best-for cards, brand cards, or price-band cards for non-priority categories.

### Product-data rules

- Hub heuristics must use only:
  - `price`
  - `brand`
  - `condition`
  - `category_slug`
  - `product_key_specs`
- If a rule cannot be supported confidently from those fields, skip the card instead of fabricating copy.

### Link rules

- `comparisonLinks` reuse the existing Phase 1 helper `buildCategorySupportLinks(...)`.
- `brandCards` and `priceBandCards` must reuse the Phase 1 eligibility helpers:
  - `buildBrandCompareCandidate(...)`
  - `buildPriceBandCandidate(...)`
- No card or link may be published from hardcoded thresholds in Phase 2.

### Card-navigation rules

- `bestForCards`
  - `href` is always the representative PDP chosen by the deterministic ranking rules below.
- `priceBandCards`
  - `href` is always the canonical Phase 1 price-band route for the eligible curated band.
- `brandCards`
  - `href` is always the representative PDP for that brand.
  - `secondaryHref` is only set when that brand participates in the canonical Phase 1 brand-compare candidate for the category.
  - `secondaryLabel` must be `Compare {leftBrand} vs {rightBrand}` when `secondaryHref` exists.
- `CategoryHubCardGrid` must render the primary card link from `href`, and must render the optional secondary compare CTA only when both `secondaryHref` and `secondaryLabel` are present.

---

## Task 1: Build the Shared Category Hub Model and Data Foundation

**Files:**
- Create: `apps/web/src/config/category-hub-defaults.ts`
- Create: `apps/web/src/lib/storefront-category/category-hub-types.ts`
- Create: `apps/web/src/lib/storefront-category/build-category-hub-model.ts`
- Test: `apps/web/src/lib/storefront-category/build-category-hub-model.test.ts`
- Modify: `apps/web/src/lib/cached-data.ts`
- Modify: `apps/web/src/lib/cached-data.products.test.ts`
- Modify: `apps/web/src/lib/normalize-product.ts`
- Modify: `apps/web/src/lib/normalize-product.test.ts`

- [ ] **Step 1: Write the failing model and data-shape tests**

Add tests that prove all of the following:

- merchant-authored `seo_heading`, `seo_description`, `seo_features`, and `seo_faq` beat curated defaults
- collection pages keep their existing `data.seo` intro/features/FAQ and emit no best-for, brand, price-band, or compare/support modules
- curated defaults fill `smartphones`, `laptops`, and `smart-tvs` when merchant-authored content is missing
- fallback intro copy for a non-priority category is bounded to one short paragraph and includes merchant/category/product-count context
- `buildCategoryHubModel(...)` returns no best-for, brand, or price-band cards for non-priority categories
- `buildCategoryHubModel(...)` emits at least one deterministic best-for card set for each priority category:
  - `smartphones`
  - `laptops`
  - `smart-tvs`
- price-band cards only include bands whose `buildPriceBandCandidate(...)` result is indexable
- brand cards only include brands that actually have meaningful representation in the current category data
- brand cards always use the representative PDP as `href`
- brand cards only expose `secondaryHref`/`secondaryLabel` when the brand participates in the canonical brand-compare candidate
- comparison links come from `buildCategorySupportLinks(...)`, not duplicated threshold logic
- the category-page cached product query now includes `product_key_specs`
- `normalizeProduct(...)` preserves `product_key_specs`

- [ ] **Step 2: Run the tests to verify they fail**

Run:

`pnpm exec vitest run src/lib/storefront-category/build-category-hub-model.test.ts src/lib/normalize-product.test.ts src/lib/cached-data.products.test.ts`

Expected:

- FAIL with missing module errors for the new hub-model files
- FAIL because category-page cached products do not currently include `product_key_specs`
- FAIL because `normalizeProduct(...)` does not currently preserve `product_key_specs`

- [ ] **Step 3: Implement the shared category hub model**

Implementation requirements:

- `category-hub-defaults.ts` must define curated content only for:
  - `smartphones`
  - `laptops`
  - `smart-tvs`
- Each priority category must include:
  - curated intro heading
  - curated intro description
  - trust features
  - FAQ items
  - section-copy helpers for:
    - best-for
    - brand highlights
    - price-band cards
- `build-category-hub-model.ts` must:
  - short-circuit collection pages first, preserving `data.seo` and suppressing all Phase 2 hub modules for those routes
  - resolve intro/features/FAQ source precedence exactly as documented above
  - build `comparisonLinks` from `buildCategorySupportLinks(...)`
  - build `priceBandCards` from all eligible curated price bands for the category, capped at the first 3 eligible bands in taxonomy order
  - build `brandCards` from the top 3 brands by active product count, ordered by:
    1. count descending
    2. brand name ascending
  - always set each brand card `href` to that brand’s representative PDP
  - only set `secondaryHref`/`secondaryLabel` on a brand card when that brand participates in the canonical Phase 1 brand-compare candidate
  - build deterministic best-for cards from bounded heuristics

### Best-for heuristics

Only these bounded rules are allowed in Phase 2:

- `smartphones`
  - `Best for Photography`: products with `main_camera_mp >= 48`
  - `Best for Battery Life`: products with `battery_mah >= 5000` or `charging_watt >= 45`
  - `Best Budget Phones`: products that fall inside the lowest eligible curated price band
- `laptops`
  - `Best for Work and School`: products with `ram_gb >= 8` or `storage_gb >= 256`
  - `Best for Performance`: products with `ram_gb >= 16`
  - `Best Budget Laptops`: products that fall inside the lowest eligible curated price band
- `smart-tvs`
  - `Best for Big-Screen Viewing`: products with `screen_size_inches >= 55`
  - `Best for Fast Motion`: products with `refresh_rate_hz >= 120`
  - `Best Budget Smart TVs`: products that fall inside the lowest eligible curated price band

If a rule produces zero qualifying products, omit that card completely.

### Representative PDP selection

For every best-for card and for every brand card primary `href`, choose one representative PDP deterministically:

- photography: `main_camera_mp` desc, then `price` asc, then `name` asc
- battery: `battery_mah` desc, then `charging_watt` desc, then `price` asc, then `name` asc
- work/school: `ram_gb` desc, then `storage_gb` desc, then `price` asc, then `name` asc
- performance: `ram_gb` desc, then `price` asc, then `name` asc
- big-screen viewing: `screen_size_inches` desc, then `price` asc, then `name` asc
- fast motion: `refresh_rate_hz` desc, then `price` asc, then `name` asc
- budget: `price` asc, then `name` asc
- brand cards: active product count desc at the brand level, then representative PDP by `price` asc, then `name` asc

- [ ] **Step 4: Re-run the model and data-shape tests**

Run:

`pnpm exec vitest run src/lib/storefront-category/build-category-hub-model.test.ts src/lib/normalize-product.test.ts src/lib/cached-data.products.test.ts`

Expected: PASS

---

## Task 2: Extract Reusable Category Hub UI Components

**Files:**
- Create: `apps/web/src/components/storefront/ogabassey/seo/category-hub-card-grid.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/seo/category-hub-card-grid.test.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/seo/category-hub-sections.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/seo/category-hub-sections.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/category-page.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/category-page.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Add tests that prove:

- `CategoryHubCardGrid` renders a section heading and crawlable links from card data
- `CategoryHubCardGrid` renders the optional secondary compare CTA when `secondaryHref` and `secondaryLabel` are present
- `CategoryHubSections` renders:
  - intro heading + description
  - trust features
  - best-for card section when cards exist
  - brand card section when cards exist
  - price-band card section when cards exist
  - compare/support links section when links exist
  - FAQ accordion when FAQ items exist
- `CategoryHubSections` omits empty sections instead of rendering blank shells
- `CategoryPage` still preserves existing pagination behavior while also rendering the extracted hub sections

- [ ] **Step 2: Run the tests to verify they fail**

Run:

`pnpm exec vitest run src/components/storefront/ogabassey/seo/category-hub-card-grid.test.tsx src/components/storefront/ogabassey/seo/category-hub-sections.test.tsx src/components/storefront/ogabassey/pages/category-page.test.tsx`

Expected:

- FAIL with missing module errors for the new hub UI files
- FAIL because `CategoryPage` does not currently accept or render shared hub content

- [ ] **Step 3: Implement the extracted hub UI**

Implementation requirements:

- `category-hub-card-grid.tsx` must be a generic themed grid for card sections and must only render links passed in through props
- `category-hub-card-grid.tsx` must render the optional secondary compare CTA only when `secondaryHref` and `secondaryLabel` are both present
- `category-hub-sections.tsx` must render all hub footer/body content and own the extracted FAQ markup from the current category page
- `category-page.tsx` must stop rendering inline SEO/footer JSX and instead render `<CategoryHubSections hub={hubContent} />`
- The extracted components must keep existing CSS-variable theming and must not hardcode merchant colors
- `CategoryPage` must keep the current product grid, filters, pagination, and mobile drawer behavior unchanged

- [ ] **Step 4: Re-run the component tests**

Run:

`pnpm exec vitest run src/components/storefront/ogabassey/seo/category-hub-card-grid.test.tsx src/components/storefront/ogabassey/seo/category-hub-sections.test.tsx src/components/storefront/ogabassey/pages/category-page.test.tsx`

Expected: PASS

---

## Task 3: Wire the Category Route and Metadata to the Shared Hub Model

**Files:**
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/category-page-content.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/page.test.tsx`

- [ ] **Step 1: Write the failing route/content tests**

Add tests that prove:

- a priority category page renders curated best-for, brand, price-band, compare/support, and FAQ sections when merchant-authored data is absent
- merchant-authored intro/FAQ content overrides curated defaults
- a collection page keeps its existing collection intro/FAQ and omits best-for, brand, price-band, and compare/support hub modules
- a non-priority category still renders intro/features/FAQ, but omits best-for, brand, and price-band blocks
- category-hub links use the request-scoped storefront host
- metadata title/description derive from the resolved hub intro
- paginated metadata contract is preserved:
  - page 1 canonical omits `?page=1`
  - page 2+ remains self-canonical
  - page 2+ title stays `{hub title fragment} - Page N | {merchant.business_name}`
- FAQ JSON-LD uses `hub.faqItems`
- the category page no longer renders the standalone `CommercialSupportLinks` footer block below the page body, because those links are now integrated into the hub sections

### Required route-test harness updates

Before adding the new assertions in `apps/web/src/app/(storefront)/[slug]/[category]/page.test.tsx`, make these explicit test-fixture changes:

- Replace the existing `CategoryPage` mock at the top of the file. It must render:
  - `currentPage`
  - `hubContent.intro.heading`
  - best-for card titles
  - brand card titles
  - price-band card titles
  - comparison-link labels
  - FAQ questions
  - optional brand-card secondary compare labels
- Extend the existing `normalizeProduct(...)` mock in that same file so it returns:
  - `product_key_specs: product.product_key_specs ?? null`
  - `category_slug: product.category_slug ?? 'smartphones'`
- Replace the current generic `products` fixture with a deterministic `smartphoneHubProducts` fixture that is rich enough to trigger the Phase 2 smartphone heuristics **and** preserve the existing pagination assertions:
  - at least 21 products total
  - at least 3 Apple smartphones
  - at least 3 Samsung smartphones
  - at least 6 products in the lowest eligible smartphone price band
  - at least one photography candidate with `main_camera_mp >= 48`
  - at least one battery candidate with `battery_mah >= 5000` or `charging_watt >= 45`
- Use explicit `product_key_specs` on those route fixtures. At minimum the fixture set must cover:
  - `main_camera_mp`
  - `battery_mah`
  - `charging_watt`
  - `ram_gb`
  - `storage_gb`
  - `screen_size_inches`
- Keep the route-level pagination expectations aligned with that fixture:
  - `page=2` must still be valid
  - `page=3` must still be out of range
- Keep laptop and smart-TV heuristic coverage in `build-category-hub-model.test.ts`; do not multiply the route test matrix across all 3 priority categories.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

`pnpm exec vitest run src/app/(storefront)/[slug]/[category]/page.test.tsx`

Expected:

- FAIL because route metadata and rendered content still use the duplicated `getSeoData(...)` logic
- FAIL because category pages do not yet render the shared hub model

- [ ] **Step 3: Implement the shared route wiring**

Implementation requirements:

- Remove the duplicated `getSeoData(...)` resolver from:
  - `page.tsx`
  - `category-page-content.tsx`
- Build the normalized category products once in `category-page-content.tsx`
- Build the shared hub model in `category-page-content.tsx`
- Build the same shared hub model in `page.tsx` for metadata generation
- Update `page.test.tsx` exactly as described in the required route-test harness updates above before adding the new assertions
- Preserve the current paginated metadata behavior while switching to the shared hub model:
  - `page=1` canonical remains the clean category URL without `?page=1`
  - `page>1` canonical remains self-referencing with `?page=N`
  - `page>1` metadata title remains `{hub title fragment} - Page N | {merchant.business_name}`
- Metadata must use:
  - `hub.intro.heading` for the category title fragment
  - `hub.intro.description` for meta description/open graph/twitter description
- FAQ JSON-LD must use `hub.faqItems`
- `category-page-content.tsx` must pass `hubContent` into the Ogabassey category page
- `category-page-content.tsx` must stop rendering the standalone `CommercialSupportLinks` footer block for category pages

- [ ] **Step 4: Re-run the route/content tests**

Run:

`pnpm exec vitest run src/app/(storefront)/[slug]/[category]/page.test.tsx`

Expected: PASS

---

## Final Verification

- [ ] Run the focused Phase 2 suite:

`pnpm exec vitest run src/lib/storefront-category/build-category-hub-model.test.ts src/lib/normalize-product.test.ts src/lib/cached-data.products.test.ts src/components/storefront/ogabassey/seo/category-hub-card-grid.test.tsx src/components/storefront/ogabassey/seo/category-hub-sections.test.tsx src/components/storefront/ogabassey/pages/category-page.test.tsx src/app/(storefront)/[slug]/[category]/page.test.tsx`

- [ ] Run web lint:

`pnpm turbo lint --filter=@baci/web`

- [ ] Run web typecheck:

`pnpm turbo typecheck --filter=@baci/web`

- [ ] Run one streamed HTML spot check locally:

`curl -s http://localhost:3222/ogabassey/smartphones | rg -n "Best for|Compare and Buying Guides|Frequently Asked Questions"`

Expected:

- the category HTML contains the enriched hub headings in the server response

---

## Execution Order

Implement in this order only:

1. shared hub model + product-data foundation
2. extracted hub UI components
3. category route/content wiring
4. full verification

Do **not** start PDP semantic enrichment, content clusters, or new route work during Phase 2.
