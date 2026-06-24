# OgaBassey Semrush Crawl Depth Reduction Implementation Plan

_Last updated: 2026-06-24_

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` before implementing this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce crawl depth for important OgaBassey catalog URLs to 3 clicks or fewer from the homepage without creating crawl bloat, harming Core Web Vitals, or weakening canonical/indexing signals.

**Architecture:** Add server-rendered, user-visible crawl discovery links to catalog hubs and pagination surfaces, then prove the affected URL set is covered with a crawl-depth graph. Keep pagination, canonical URL builders, sitemaps, and crawl-waste controls aligned so the fix improves real navigation rather than only satisfying one audit.

**Tech Stack:** Next.js 16 App Router, React Server Components, TypeScript, Supabase-backed catalog data, `next/link`, existing storefront SEO helpers, Biome, Vitest/Testing Library.

---

## Status

Implemented as a scoped catalog crawl-depth PR after rereview. This document plans and tracks the response to the Semrush notice:

> 925 pages need more than 3 clicks to be reached.

The code-actionable catalog work is implemented in the PR branch. Semrush recrawl, production raw-HTML checks after deployment, and any remaining blog/subdomain follow-ups must happen after merge/deploy because those require external crawler state.

Implementation progress on 2026-06-24:

- Phase 0 baseline classification documented in `docs/perf/ogabassey-semrush-crawl-depth-audit-2026-06-24.md` using the pasted Semrush export rows and live raw-HTML probes.
- Phase 1 code slice implemented: `StorefrontPagination` now supports an optional bounded crawl discovery link block backed by `getStorefrontCrawlDiscoveryPages`.
- Phase 2 `/products` discovery slice implemented: `/products` opts into the product-page threshold so current catalogs with `totalPages <= 100` expose every product index page as text links with `prefetch={false}`.
- Category listing pages opt into the category threshold so categories with `totalPages <= 20` expose every page link.
- Phase 3 and Phase 4 source review found existing category hub, compare/price-band, commercial support, related-product, and PDP semantic-link surfaces; this PR does not add thin new hub routes.
- Phase 5 and Phase 6 are documented as verification outcomes: no filter/sort/search URL families are linked by this PR, out-of-range product pagination already returns noindex metadata in current branch source, and sitemap changes are intentionally not used as the crawl-depth fix.
- Local tests cover the helper, shared pagination rendering, `/products` wiring, and category page rendering.
- Local verification passed in the PR worktree:
  - focused Vitest run for pagination, category page, and `/products` page content tests: 63 passed,
  - `pnpm turbo lint --filter=@baci/web`,
  - `pnpm turbo typecheck --filter=@baci/web`,
  - `pnpm turbo test --filter=@baci/web`: 1,893 test files passed, 15,016 tests passed, 1 skipped file, 1 todo,
  - `git diff --check`.
- Post-deploy raw HTML checks and Semrush recrawl remain pending external verification.

## Current Finding

The Semrush warning is valid, but it is not primarily a sitemap problem.

Production already exposes storefront sitemaps in `robots.txt`:

- `https://ogabassey.com/sitemap/static.xml`
- `https://ogabassey.com/sitemap/products.xml`
- `https://ogabassey.com/sitemap/categories.xml`
- `https://ogabassey.com/sitemap/commercial-support.xml`
- blog sitemaps when enabled

The issue is HTML crawl depth. Several important product pages are reachable only after walking through category/product pagination.

Current code evidence:

- `StorefrontPagination` exposes only page `1`, last page, current page, and `current +/- 1` for larger page sets. This keeps the UI compact but hides middle pages behind multiple crawl hops.
  - File: `apps/web/src/components/storefront/ogabassey/components/StorefrontPagination.tsx`
- `/products` links categories and only the first 18 first-page products as "Popular Product Links".
  - File: `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/products/products-page-content.tsx`
- Category pages already render product links for the current page and category hub links, but not enough direct links to deeper paginated states.
  - File: `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/category-page-content.tsx`
- The homepage currently has raw `/products` and category-root links in fetched HTML. The top category navigation is also opened by a client-side button/dropdown, but crawl-depth proofs must only count the raw anchors, not links that appear only after clicking `Shop by Category`.
  - File: `apps/web/src/components/storefront/ogabassey/components/HomeProductGrid.tsx`
  - File: `apps/web/src/components/storefront/ogabassey/layout/navbar-secondary-nav.tsx`

## 2026 Source Alignment

This plan follows current search guidance:

- Google ecommerce site structure: navigation and cross-page links influence how Google understands page relationships and page importance. Category pages should lead to products, and important products/categories should be promoted with internal links.
  - https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure
- Google pagination guidance: crawlers discover URLs in `<a href>` links; they do not click buttons or trigger user-action JavaScript. Pagination should expose crawlable links.
  - https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
- Google ecommerce URL guidance: internal links, canonicals, and sitemaps should use consistent canonical URLs. Avoid linking to or indexing pages without useful content.
  - https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites
- Google faceted navigation guidance: filter/facet parameters can create infinite URL spaces. Non-index-worthy filter/sort states should not become crawlable/indexable inventory.
  - https://developers.google.com/crawling/docs/faceted-navigation
- Google sitemap guidance: sitemaps help discovery, but important pages should also be reachable through navigation/internal links.
  - https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
- Semrush Site Audit: crawl depth is the number of clicks needed to reach a page; 4+ clicks suggests important pages may need more internal links.
  - https://www.semrush.com/kb/544-site-audit-statistics

## Principles

1. Fix crawl depth with real user-visible HTML links, not crawler-only hacks.
2. Keep links as crawlable `<a href>` anchors with meaningful text.
3. Keep previous/next pagination and add crawl discovery; do not replace one with the other.
4. Keep canonical URL usage consistent across internal links, sitemap URLs, and metadata.
5. Do not turn category roots into giant product dumps.
6. Do not expose unbounded filter/sort/search URL combinations.
7. Preserve Core Web Vitals, especially mobile LCP and CLS.
8. Do not touch `apps/web/src/proxy.ts` for this crawl-depth work unless a later, separately approved hard-status task requires it.
9. Prove depth with a crawl graph over affected URLs, not only a few successful sample links.
10. Respect Baci modularity rules. Do not add new logic to already oversized storefront page files when a focused helper or SEO component can own the behavior.
11. Only count links that appear in fetched HTML or server-rendered output. Client-triggered dropdowns, search boxes, and buttons are useful UX, but they do not count as shallow crawl paths unless their destination anchors are present without user action.

## Non-goals

- Do not noindex canonical product pages just to silence Semrush.
- Do not block `?page=` URLs in `robots.txt`.
- Do not create hundreds of thin, auto-generated filter landing pages.
- Do not add `rel=prev`/`rel=next` as the primary fix. Crawlable anchors and canonical URLs matter more for current Google behavior.
- Do not rely on sparse jump links unless the affected URL graph proves they satisfy the 3-click target.
- Do not run cloud-building deploy commands from Codex. Follow the repo prebuilt deploy flow when deployment is requested.

## Implementation Plan

### Phase 0: Baseline and classification

- [x] Export the Semrush affected URL list and group URLs by type:
  - product detail pages
  - category pagination pages
  - `/products?page=N` pages
  - compare pages
  - blog/content pages
  - subdomains such as `installments.ogabassey.com`
  - filter/sort/search parameter URLs, if any
- [x] Mark each URL group as:
  - index-worthy canonical inventory
  - useful but not primary landing pages
  - duplicate/low-value crawl waste
  - broken or should not exist
- [x] Save a baseline crawl-depth sample for representative URLs:
  - `/smartphones/iphone-x-3gb-256gb`
  - `/smartphones/samsung-galaxy-s25-ultra-12gb-256gb`
  - `/smartphones?page=6`
  - `/products?page=64`
  - one compare page from the Semrush export
- [x] Verify raw HTML, not only browser UI, contains the links being evaluated:
  - homepage contains a crawlable `/products` link,
  - category-root links are present in raw HTML if category-root paths are used in the depth proof,
  - category dropdown links hidden behind a button are treated as UX links, not crawl-depth proof.
- [x] For important affected PDP classes in the pasted export, identify the shortest intended path:
  - primary PDP route: `home -> products -> product-index page N -> PDP`
  - category-root PDP route only if the category root is linked from raw homepage/nav/footer HTML: `home -> category root -> page N -> PDP`
  - `home -> curated hub -> PDP`
- [x] Record which index page or curated hub must receive a direct link from a shallow source.

Acceptance:

- A short baseline table exists in the PR description or a follow-up audit note with URL, current depth, URL class, canonical/indexing decision, source path, intended fix, and expected post-fix depth.
- The table distinguishes product PDPs, paginated listing pages, compare pages, filter/search/sort URLs, and subdomain URLs.

### Phase 1: Coverage-driven crawl pagination index

Create a small reusable server-rendered/crawlable pagination discovery component or extend the existing pagination component with a bounded discovery mode.

Target behavior:

- Keep current Previous/Next links.
- Keep current compact page controls for ordinary UX.
- Add an optional crawl discovery block with direct page links.
- For category pages with `totalPages <= 20`, expose all page links.
- For current `/products` scale, expose every product index page when `totalPages <= 100` and the links remain text-only, below primary content, and `prefetch={false}`.
- For larger future indexes, expose a coverage-driven set:
  - all pages that contain Semrush-affected or business-critical PDPs,
  - first 10 pages,
  - last 10 pages,
  - current page window,
  - bounded jump links such as every 5th or 10th page,
  - no more than a configured maximum number of page links unless the baseline proves a larger set is required.
- If a cap would leave an important PDP deeper than 3 clicks, add or link a meaningful category/brand/price-band hub instead of silently accepting the gap.

Candidate files:

- `apps/web/src/components/storefront/ogabassey/components/StorefrontPagination.tsx`
- `apps/web/src/components/storefront/ogabassey/components/StorefrontPagination.test.tsx`
- `apps/web/src/components/storefront/ogabassey/components/StorefrontPaginationDiscovery.tsx`
- `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/category-page-content.tsx`
- `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/products/products-page-content.tsx`
- `apps/web/src/lib/storefront-pagination.ts`
- `apps/web/src/lib/storefront-pagination.test.ts`

Implementation notes:

- Use normal `Link`/`<a href>` output with `prefetch={false}`.
- Anchor text should be descriptive enough for humans and crawlers, for example `Page 6 of smartphones` or `Products page 64`.
- Avoid a visual wall of links; use a compact section label such as "Browse more pages".
- Keep the block visible or at least accessible. Do not hide it as crawler-only text.
- Keep page-set generation in `apps/web/src/lib/storefront-pagination.ts` so it can be unit tested without rendering the full storefront.
- Keep the visual discovery block in its own focused component if adding it to `StorefrontPagination.tsx` would make that component harder to scan.

Acceptance:

- Raw HTML for `https://ogabassey.com/smartphones` includes direct links to middle pages such as `/smartphones?page=6`.
- Raw HTML for `https://ogabassey.com/products` includes direct links to every product index page when current `totalPages <= 100`, including useful deeper pages such as `/products?page=64`.
- Existing pagination behavior remains intact.
- A crawl-depth graph or exported crawl table proves the representative important PDPs are reachable in 3 clicks or fewer.

### Phase 2: Strengthen `/products` and shallow category entry points

Improve `/products` so it acts as the main shallow route into the complete catalog, and make sure any category-root depth claim starts from a real crawlable anchor.

Changes:

- Keep the current category link section.
- Add a bounded "Browse product index pages" section using the Phase 1 crawl index.
- Keep "Popular Product Links", but review whether the first-page-only source is correct. Prefer high-value or recently updated products if existing data supports that safely.
- Do not load all products into `/products`.
- Do not replace product-index page links with a larger product-card payload. This phase adds text links, not another catalog grid.
- Confirm the homepage raw HTML includes a direct `/products` anchor. Preserve it if already present.
- For priority categories that must satisfy `home -> category root -> page N -> PDP`, add crawlable raw anchors from a shallow source such as homepage, footer, or a server-rendered nav section. Do not count the current client-only `Shop by Category` dropdown for this proof.
- If raw category anchors are not added, use `/products` as the primary PDP crawl path and document category-root pages separately as listing URLs.

Candidate files:

- `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/products/products-page-content.tsx`
- `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/products/page.test.tsx`
- `apps/web/src/components/storefront/ogabassey/components/HomeProductGrid.tsx`
- `apps/web/src/components/storefront/ogabassey/components/HomeProductGrid.test.tsx`
- `apps/web/src/components/storefront/ogabassey/components/Footer.tsx`
- `apps/web/src/components/storefront/ogabassey/components/Footer.test.tsx`
- `apps/web/src/components/storefront/ogabassey/layout/navbar-secondary-nav.tsx`
- `apps/web/src/components/storefront/ogabassey/layout/navbar-secondary-nav.test.tsx`

Acceptance:

- Important products become reachable through `home -> products -> product-index page -> PDP`.
- `/products` remains performant and does not render hundreds of product cards.
- The post-change crawl table shows no important PDP is left relying on `/products` sparse jump links alone.
- Homepage raw HTML contains a direct `/products` link.
- If the crawl-depth report uses `home -> category root`, homepage/nav/footer raw HTML also contains the category root link. Otherwise the report must use `/products` as the shallow source and not count the client-only category dropdown.

### Phase 3: Expand category hub links with curated clusters

Use useful category-level sections to create shorter paths into product families without generating thin pages.

Preferred link types:

- existing price-band pages, such as `/smartphones/best-under/under-500k`
- existing compare pages, such as `/smartphones/compare/apple-vs-samsung`
- curated brand/product-family routes where the route is already meaningful and indexable
- high-value guide/blog links that help users choose products

Candidate files:

- `apps/web/src/lib/storefront-category/build-category-hub-model.ts`
- `apps/web/src/lib/storefront-category/category-hub-cards.ts`
- `apps/web/src/lib/storefront-category/category-hub-price-band-cards.ts`
- `apps/web/src/lib/storefront-compare/build-commercial-support-links.ts`
- `apps/web/src/components/storefront/ogabassey/seo/category-hub-sections.tsx`

Guardrails:

- Do not auto-create one landing page per arbitrary brand/filter combination.
- Each linked hub must have useful content, product coverage, and a canonical URL.
- Keep link count reasonable and avoid repeating the same links across every page unless the link is genuinely structural.
- Add a new curated hub link only when it has:
  - at least 3 relevant published products or a stronger manually documented reason,
  - unique heading/intro copy that matches the linked inventory,
  - a self-canonical URL if indexable,
  - no empty state for normal crawlers,
  - a clear user task such as comparing brands, shopping a price band, or choosing a product family.

Acceptance:

- Category roots expose more direct paths to commercial-support pages and product clusters.
- No new thin/indexable filter pages are introduced.
- Any new hub route appears in the baseline table with its product coverage and canonical/indexing decision.

### Phase 4: PDP cross-linking improvements

Improve internal links from product pages so deep PDPs gain more incoming and outgoing context.

Possible links:

- breadcrumb/category link
- related products
- compare page, when an eligible compare page exists
- price-band page, when the current product belongs to an existing curated band
- buyer guide/blog link, when category support exists

Candidate files:

- `apps/web/src/components/storefront/ogabassey/seo/ProductInternalLinks.tsx`
- `apps/web/src/components/storefront/ogabassey/seo/ProductInternalLinks.test.tsx`
- `apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.tsx`
- `apps/web/src/lib/storefront-compare/build-commercial-support-links.ts`
- `apps/web/src/lib/storefront-product/build-product-semantic-model.ts`
- `apps/web/src/lib/storefront-product/build-product-internal-links.ts`
- `apps/web/src/lib/storefront-product/build-product-internal-links.test.ts`

Implementation notes:

- Treat `apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx` and `apps/web/src/components/storefront/ogabassey/pages/category-page.tsx` as integration surfaces only. They are already oversized, so new logic belongs in focused SEO components and helpers.
- Keep each new file focused on one responsibility and add colocated tests for runtime logic.
- Use existing semantic models and canonical URL builders. Do not hand-assemble URLs when a local helper already exists.

Acceptance:

- Raw HTML for representative PDPs includes category, related product, and commercial-support links where data exists.
- No links point to empty or non-canonical destinations.
- Existing PDP rendering remains visually stable and the new links do not add large image or script payloads.

### Phase 5: Crawl waste controls

Audit and control non-canonical URL inventory before expanding internal links further.

Checks:

- Verify out-of-range pagination behavior with both HTTP status and HTML metadata:
  - `curl -I https://ogabassey.com/smartphones?page=9999`
  - `curl -Ls https://ogabassey.com/smartphones?page=9999 | grep -Ei 'robots|canonical|not found'`
  - `curl -I https://ogabassey.com/products?page=9999`
  - `curl -Ls https://ogabassey.com/products?page=9999 | grep -Ei 'robots|canonical|not found'`
- Record whether the route is a hard `404`, a soft `notFound()`/`noindex`, or an indexable empty page.
- Decide separately whether a future hard-404/proxy task is needed. Do not modify `apps/web/src/proxy.ts` in this plan.
- Verify filter/sort states are client-side or canonical/noindexed if URL-backed.
- Verify search pages with arbitrary queries are not accidentally indexable as infinite inventory.
- Verify compare pages remain curated and do not expose every possible product pair.

Rules:

- Do not block canonical category/product pagination.
- Do not use `robots.txt` for pages that need to pass link equity but should not index; choose canonical/noindex carefully based on the URL class.
- For empty categories or nonsensical filter combinations, prefer 404/noindex according to the current route behavior and Google guidance.

Acceptance:

- Semrush export contains no large family of crawlable filter/sort parameter URLs.
- If such URLs exist, a separate crawl-waste plan is opened before broader internal linking expansion.
- Out-of-range pagination is documented with status code, robots/canonical signal, and recommended follow-up if it is not a hard `404`.

### Phase 6: Sitemap and feed consistency

Keep the existing sitemap setup healthy, but do not depend on it for Semrush click-depth fixes.

Checks:

- `robots.txt` advertises active storefront sitemaps on `ogabassey.com`.
- Product sitemap contains canonical PDP URLs.
- Category sitemap contains canonical category roots.
- Commercial-support sitemap contains only curated/index-worthy support pages.
- `lastmod` values reflect meaningful changes rather than request time.

Decision point:

- Only add paginated category/product-index sitemap entries if those pages are deliberately indexable and self-canonical. Do not add them solely to reduce Semrush crawl depth.

Acceptance:

- Internal links, canonical metadata, and sitemap entries all use the same canonical URL shape.

### Phase 7: Verification

Local/code verification:

- [x] Unit tests for pagination discovery generation:
  - small total pages exposes all pages
  - current `/products` scale exposes all pages when `totalPages <= 100`
  - large total pages is capped but preserves affected/business-critical pages
  - current window and last page are preserved
  - links use `buildStorefrontPageHref`
- [x] Route/page tests for category pages and `/products` proving crawl discovery links render.
- [x] Existing pagination tests still pass.
- [x] Unit tests for PDP internal-link generation if Phase 4 is implemented. Not applicable to this PR because no new PDP internal-link generator was added; source review found the existing semantic-link surfaces already present.

Live/raw HTML verification after deploy:

```bash
curl -Ls https://ogabassey.com/ | grep -o 'href="[^"]*"' | grep '/products'
# Required only if category-root paths are used in the crawl-depth proof:
curl -Ls https://ogabassey.com/ | grep -o 'href="[^"]*"' | grep '/smartphones'
curl -Ls https://ogabassey.com/smartphones | grep -o 'href="[^"]*"' | grep 'smartphones?page=6'
curl -Ls https://ogabassey.com/products | grep -o 'href="[^"]*"' | grep 'products?page=64'
curl -Ls https://ogabassey.com/products | grep -o 'href="[^"]*"' | grep 'products?page='
curl -Ls https://ogabassey.com/smartphones?page=6 | grep -o 'href="[^"]*"' | grep '/smartphones/'
curl -I https://ogabassey.com/products?page=9999
curl -Ls https://ogabassey.com/products?page=9999 | grep -Ei 'robots|canonical|not found'
```

Crawl verification:

- Run a crawl from `https://ogabassey.com/`.
- Export the crawl graph or path table used for approval.
- Confirm representative affected products are reachable in 3 clicks or fewer:
  - `home -> products -> page N -> PDP`
  - `home -> smartphones -> page N -> PDP`, only when `/smartphones` is linked in raw homepage/nav/footer HTML
- Confirm all Semrush-affected URLs classified as important are either:
  - reachable in 3 clicks or fewer,
  - deliberately classified as low-value/duplicate/crawl waste,
  - assigned to a follow-up hub/cross-linking phase with the reason documented.
- Re-run Semrush Site Audit after deployment and crawl cache expiry.

Quality gates for code changes:

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
coderabbit review --prompt-only -t uncommitted
```

For a narrow implementation PR, targeted test runs are acceptable during development, but the full gate is required before shipping when practical.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Too many links on large catalogs | Expose all pages only at current bounded scale; for larger totals, preserve affected pages and add meaningful hubs instead of unlimited page links. |
| UI clutter | Compact, grouped discovery section; preserve existing pagination UX. |
| Core Web Vitals regression | Links are text-only, below primary content, `prefetch={false}`; avoid loading extra product cards. |
| Crawl bloat from filters | Audit URL classes first; do not link arbitrary filter combinations. |
| Duplicate canonical signals | Use existing canonical URL builders and `buildStorefrontPageHref`. |
| Thin pages | Only link curated/index-worthy hubs and pages with product coverage. |
| Protected middleware risk | Do not touch `proxy.ts` in this plan. |
| Oversized storefront files | Add focused helpers/components and use large page files only as integration surfaces. |
| Sparse jump links miss affected pages | Make the generated page set coverage-driven and prove it with the affected URL crawl graph. |
| Client-only navigation is counted as crawlable | Require raw HTML proof for `/products` and any category-root links used in the crawl-depth path table. |

## Rollout Sequence

1. PR 1: Adaptive crawl pagination component and tests plus wiring into category pages and `/products`. Implemented in this PR because both slices are small and share the same test surface.
2. PR 2: Curated category hub link expansion, only if the post-deploy crawl graph still shows many important PDPs deeper than 3 clicks after the pagination fix.
3. PR 3: PDP cross-linking improvements, only if raw HTML shows weak related/support links on representative PDPs after deployment.
4. PR 4: Crawl waste cleanup for any filter/sort/search URL families discovered in a fresh Semrush export.

Each PR should include:

- current-source verification,
- targeted tests,
- raw HTML proof,
- homepage or shallow-source proof for `/products` and any category roots used in depth claims,
- crawl-depth graph proof for the URL class touched by the PR,
- no unrelated refactors,
- no existing migration edits.

## Success Criteria

- Semrush affected count drops materially after recrawl.
- Important product PDPs are reachable within 3 clicks from the homepage, proven by a crawl graph or exported path table.
- Product/category sitemaps still contain canonical URLs.
- No new large family of filter/sort/search URLs is introduced.
- Category and product pages remain performant on mobile.
- The fix improves real user navigation, not only crawler behavior.
