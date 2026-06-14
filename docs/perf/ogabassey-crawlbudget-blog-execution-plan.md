# OgaBassey — Crawl-Budget, Hard-404, and Blog CWV Execution Plan

> Status: **draft for review.** PR #2479 (PDP static-hero LCP) is the prerequisite and should merge first. This document specifies the follow-on work as three reviewable PRs (B, C, D). Every claim here is backed by a live probe, a PSI/DebugBear measurement, an official-doc citation, or a code reference (see Appendix).

---

## 0. Context & how we got here

The PDP LCP investigation revealed that OgaBassey's storefront was **deliberately forced fully-dynamic** by three `connection()` guards + a proxy `no-store`, all added (2026-05-30/31) to dodge a Next 16 PPR resume/metadata-boundary bug. That bug was later fixed by `patches/next@16.2.9.patch` (PR #2436, upstream `vercel/next.js#94630`), which made the guards vestigial. PR #2479 removes them + adds `generateStaticParams` so the PDP hero ships in the static shell (LCP ~3.9s → ~1.3s, verified locally).

While auditing, we measured the blog CWV for the first time and swept the site for crawl-budget waste. This plan captures that work.

**Guiding constraint from the owner:** conserve crawl budget as much as possible.

---

## 1. PR #2479 — PDP static-hero LCP (DONE, in review) — reference only

Already implemented, tested, pushed; included here so reviewers see the full arc.

- **Change:** remove 3 `connection()` guards (page + `[slug]/layout` + `(catalog)/(pdp)/layout`); add `generateStaticParams` (50 newest active OgaBassey PDPs; long tail on-demand); lift the PDP/category `no-store` → cacheable, **scoped to confirmed-public clean canonical URLs only** (see review fixes).
- **Verified (local prod build, mobile Slow-4G/4×CPU):** prerendered PDP LCP 1258ms (was ~3900ms), CLS 0, render delay 23ms; browser + Googlebot get full route-specific metadata in the static head (also fixes the old crawler "Ogabassey" generic-title bug); zero `#92087` resume digests in logs.
- **Review fixes applied (Codex + Jules):**
  - **Data-leak fix (Codex P2, real):** the first cut set `s-maxage` on any 2-segment storefront doc, which on custom domains caught per-user routes (`/account`, `/checkout`, `/receipts`, `/order-success`, `/my-account`). Now only confirmed-public, **param-free** canonical PDP/category shells are cached (`NON_CACHEABLE_STOREFRONT_FIRST_SEGMENTS` + `isCacheablePublicStorefrontDocument`), with explicit leak-prevention tests.
  - **Layout tests (Codex P1):** updated to assert `connection()` is no longer called.
  - **Variant redirect (Codex/Jules):** param URLs are no longer cached, removing the cache-amplification of the streamed redirect; the strict-308 fix is folded into PR-B (proxy variant validation).
  - **Jules HIGH "PDP per-user data leak":** false positive (verified zero per-user server reads); the real vector was Codex's predicate breadth, now fixed.
  - **Jules MEDIUM hardcoded tenant:** optional `PRERENDER_PRIORITY_MERCHANTS` config — deferred (OgaBassey is already special-cased in 18 files).
- **Post-merge canary (carry into deploy):** watch Vercel logs for digest `1617769459` / `__next_metadata_boundary__` across browser + Googlebot on several PDPs ~30 min; confirm `x-vercel-cache: HIT` on PDPs; re-measure PSI; roll back if the resume digest reappears. (Local `next start` cannot reproduce the Vercel edge cache-replay.)

---

## 2. The crawl-budget picture (why this matters, sized correctly)

At **~1,237 products** OgaBassey is **well under** Google's crawl-budget thresholds (1M+ pages, or 10k+ with daily churn). So this is **not** "huge site" crawl management — it's **stopping self-inflicted waste**. Google's Crawl Budget doc (updated 2025-12-19): *"perceived inventory … wastes a lot of Google crawling time … This is the factor that you can positively control the most."*

Two defects convert a finite catalog into a near-infinite **indexable** URL space:
1. **Doorway trap** — any single-segment `/X` returns **200 + `index,follow` + self-canonical** (verified live).
2. **Soft-404 200s** on missing products/blog — Google recrawls them forever; *"a 404 is a strong signal not to crawl that URL again"* (same doc).

Both share one fix-point: **a fast existence check in `proxy.ts` that emits a hard status before the body streams** (the official Next 16 recommendation; see §3.1).

---

## 3. PR-B — Crawl-budget core (highest leverage). **Needs proxy.ts approval.**

### 3.1 Why a proxy-level hard 404/410 (not page-level `notFound()`)

Under PPR, `notFound()` **cannot** set a 404 status — Next 16.2.9 `loading.js` → "Status Codes" (updated 2026-03-13): *"When streaming, a 200 status code will be returned … the status code of the response cannot be updated."* and the named remedy: *"run this check in `proxy` to rewrite missing slugs to a not-found route, or produce a 404 response. Keep proxy checks fast, and avoid fetching full content there."* We verified this empirically: a missing product returns 200 + `noindex` even after `notFound()` fires in the page body.

Google ranking for removed resources (Crawl Budget, 2025-12-19): **404/410 > 301-to-replacement > `noindex`-200 > soft-404 (worst)**. *"Don't use noindex — Google will still request, then drop the page … wasting crawling time."*

### 3.2 Mechanism (concrete)

`proxy.ts` is already the Next 16 proxy file (middleware→proxy rename, v16.0.0). `NextResponse` extends the Web Response API, so it supports any status incl. **410** (which `rewrite/redirect/json` don't cleanly expose):

```ts
// apps/web/src/proxy.ts  (PROTECTED FILE)
const slug = matchProductOrCategorySlug(pathname);     // tight matcher, string parse only
if (slug) {
  const state = await getSlugState(merchantId, slug);  // O(1) cached set membership
  if (state === 'missing')      return new NextResponse(notFoundHtml, { status: 404, headers });
  if (state === 'discontinued') return new NextResponse(goneHtml,   { status: 410, headers });
}
return NextResponse.next();
```

- **404** for typos / unknown slugs / never-existed.
- **410** for products with an explicit `archived`/`deleted` status flag (stronger permanence signal; one-line branch off the status flag).

### 3.3 Cheapest existence signal (the "keep proxy checks fast" requirement)

There is **no dedicated slug-set cache today**, and **`proxy.ts` runs the Edge runtime by default** where the `'use cache'` server functions (`getCachedMerchant`, `getCachedProductLcpHint`) are **not callable**. Plan (ranked by cost):

1. **(Recommended)** New `getCachedStorefrontProductSlugSet(merchantId) → Set<string>` and `getCachedStorefrontCategorySlugSet(merchantId)`, populated by a `use cache`-wrapped existence query, invalidated via `revalidateTag('products')` / `revalidateTag('categories')` on publish/unpublish/archive (the existing `cache-revalidation.ts` already fires these tags). The proxy reaches them by **scoping the PDP/category branch to the Node runtime** (or `fetch`ing an internal route handler). Membership test, not a row fetch — satisfies Google's "avoid fetching full content."
   - Existing close primitive: `getCachedProductLcpHint(merchantId, slug)` (`lib/cached-data.ts` ~1141) is a per-slug `'use cache: remote'` tagged existence probe — but per-slug and Edge-uncallable, so usable only on the Node path, not as the set.
2. **(Fallback / defense-in-depth)** Bloom filter of live slugs for pure-CPU negative checks — not needed at 1,237 SKUs; false positives fall through to the existing `notFound()` `noindex`-200 path (acceptable second line).

### 3.4 The doorway trap (urgent — index bloat) — and a same-PR stopgap

**Root cause (verified):** `[slug]/(catalog)/(listing)/[category]/page.tsx` only `notFound()`s for **inactive** categories. For an unknown slug, `getCachedCategoryPageData` (`lib/cached-data.ts` ~1850) hits a **legacy fuzzy-search fallback** (`category.ilike.%slug%,brand.ilike.%slug%,name.ilike.%slug%`), returns `category: null, products: [], isInactiveCategory: false`, and the page renders **`index,follow`**.

**Stopgap (page-level, ships in PR-B immediately, flips `index,follow` → `noindex`):** in the `[category]` route's `generateMetadata` AND page render, add next to the inactive-category guard:
```ts
// Genuinely unknown slug: no category row, no fuzzy-matched products, not a
// collection → 404 instead of an indexable empty doorway page.
if (!data.isCollection && !data.category?.id && data.products.length === 0) {
  notFound();
}
```
Excludes real categories (have `category.id`), brand/collection pages (have products), inactive categories (already 404). Under PPR this is a soft-404 (200 + `noindex`) — **stops index bloat now**; §3.2 upgrades it to a hard 404 once the category slug-set lands.

### 3.5 `usebaci.com` canonical leak

**Verified live:** bogus PDP and pagination canonicalize to `https://usebaci.com/...` (the platform domain), not `ogabassey.com`. **Root cause:** `buildStoreUrl` (`lib/store-url.ts` ~55-74) returns `https://{slug}.usebaci.com` when `custom_domain` is null. **Fix:** switch PDP/category/pagination canonical generation to `buildRequestScopedStoreUrl` (live host) and/or ensure `custom_domain` is populated for OgaBassey. Affects indexed canonical signals — verify host resolution on a preview.

### 3.6 PR-B scope, tests, risk

- **Files:** `proxy.ts` (matcher + Node-runtime branch + 404/410), new `lib/cached-storefront-product-slug-set.ts` + category equivalent, `[category]/page.tsx` (doorway stopgap), `lib/store-url.ts` (canonical fix). Colocated tests for each + `proxy.test.ts` (status assertions for missing/discontinued/valid).
- **Risk:** proxy is protected (auth/CSRF/rate-limit/custom-domains) — **explicit approval required**; Node-runtime move changes deploy characteristics (scope to the PDP/category matcher only); **false-positive 410 is destructive** (de-indexes a live product) — default to 404, 410 only on an explicit `archived`/`deleted` flag, and the slug-set must be correctly tag-invalidated on every publish.
- **Verification:** preview deploy — `curl -s -o /dev/null -w "%{http_code}"` on: real product (200), missing product (404), discontinued (410), invalid merchant (404), legacy/category-mismatch slug (308 — must not regress), doorway slug (404/noindex). Then Search Console: soft-404 count drops, crawl stats shift to product URLs.

---

## 4. PR-C — SEO hygiene (no proxy needed)

### 4.1 Pagination cap
**Verified:** `?page=N` is unbounded → 200; mid-range `noindex`, but **extreme page numbers flip back to `index,follow`**, and all leak the `usebaci.com` canonical. Google faceted-nav doc (2025-12-18): *"Return an HTTP 404 when a filter combination doesn't return results."*
**Fix:** in listing metadata (`seo-utils.ts` `getIndexableRobotsMetadata` + `getCanonicalStorefrontFilterSearchParams` ~1660-1770) cap pagination — out-of-range `?page=N` → 404 (or canonical to page 1); fix the `usebaci.com` canonical (shares §3.5 root cause). Don't 404 valid in-range pages — verify real page count per category.

### 4.2 Sitemap parent-only filter
**Verified:** the product sitemap includes variant-child URLs the listing index excludes. **Fix:** `[slug]/sitemap-data.ts` `getProductSitemapEntries` — add `.or('is_parent.eq.true,parent_product_id.is.null')` to match `getCachedStorefrontProductIndex`. Verify no legitimate standalone variant slugs are dropped.

---

## 5. PR-D — Blog static-shell (CWV) — mirrors #2479

### 5.1 Measured CWV (first measurement)
| | Index Mobile | Index Desktop | Post Mobile | **Field p75 (mobile)** |
|---|---|---|---|---|
| Perf | 72 | 91 | 80 | — |
| LCP | 7.1s lab | 1.6s | 5.1s lab | **4608ms — FAIL** |
| FCP | 1.7s | 0.4s | 1.7s | **4084ms — FAIL** |
| CLS | 0 | 0 | 0 | 0.10 |
| TTFB | warm | warm | warm | **1427ms** |

Mobile fails; desktop healthy; CLS perfect. Blog canonical correctly points to the merchant domain (no `usebaci.com` leak). Blog sitemap: 392 URLs.

### 5.2 Root causes (same family as PDP)
- Render-blocking storefront CSS (~790ms) — **shared with PDPs**.
- Hero inside the Suspense/PPR stream (not in static shell).
- **Post hero missing `fetchpriority="high"`** — `lcp-discovery-insight` scored 0, `priorityHinted:false`, despite `priority` in source (`blog-post-page-content.tsx:174`).

### 5.3 Fixes (priority)
1. **[HIGH-post, S]** Fix post-hero `fetchpriority="high"`/preload (the `fill`+`priority` path is stripped at `blog-post-page-content.tsx:174`).
2. **[HIGH-both, M]** Split/inline the blog/storefront critical CSS so the blog route doesn't pull the full PDP stylesheet — shared win with PDP.
3. **[HIGH-both, M]** Move the hero + its preload above the Suspense boundary / into the static prerender.
4. **[MED-index, S]** Tighten the index hero `sizes` from `100vw`.
5. **[MED-field, M]** `generateStaticParams` for the 392 blog posts → moves hero into the static prerender, CDN-caches the HTML (fixes TTFB), fixes mobile LCP. **Direct extension of #2479's pattern.** (Note: prerendering does NOT fix missing posts — those need the §3 proxy hard-404.)
6. **[LOW-SEO, S]** `NewsArticle` JSON-LD for time-sensitive posts (a `news-sitemap.xml` already exists); keep `BlogPosting` for evergreen.

---

## 6. Verified NON-issues (do NOT spend effort here)
- Facet/tracking/`?variantId=`/`?__baci_metadata_cache_bucket=` params **self-canonicalize** to the clean URL (`getValidatedProductUrl` discards canonicals carrying `search`/`hash`).
- The `__baci_metadata_cache_bucket` param does **not** create crawlable duplicates (internal-rewrite only; 0 occurrences in `products.xml`/canonicals).
- **No redirect chains** — every case is exactly 1 hop (www→apex, http→https, trailing-slash 308, case 308).
- **Sitemap hygiene clean** — all sampled URLs 200/self-canonical/`index,follow`; real `lastmod`; empty result → 503+`no-store` (not empty-200). Counts: products 1,237 · categories 27 · blog 392 · news 18 · static 4 · commercial-support 19.
- **`/product/<slug>`** is a 308 redirect; **`/products/<slug>`** is a live fallback for uncategorized products — **do NOT robots-Disallow either** (would break the 308s / uncategorized PDPs).

---

## 7. Sequencing & dependencies
1. **Merge #2479** (LCP + review fixes) + run its canary.
2. **PR-B** (crawl-budget core): doorway stopgap + `usebaci` canonical (no proxy) can land first; the proxy hard-404/410 + slug-sets follow once proxy edit is approved. Highest crawl-budget leverage.
3. **PR-C** (pagination cap + sitemap filter): shares the `usebaci` canonical fix; small.
4. **PR-D** (blog static-shell): quick win (post `fetchpriority`) + the `generateStaticParams` mirror of #2479.

Shared root causes across PRs: the **`usebaci.com` canonical** (B + C), the **render-blocking CSS** (D + PDP), the **proxy existence check** (B doorway + B soft-404 + C pagination-404).

---

## 8. Open decisions for the owner
1. **Approve the `proxy.ts` edit** for the hard-404/410 + the Node-runtime PDP/category branch (PR-B core)? Without it, the doorway trap and soft-404s can only be downgraded to `noindex`-200, not hard 404 — still a big win, but not the crawl-budget optimum.
2. **404 vs 410 policy** — confirm: 404 default for unknown/missing; 410 only on explicit `archived`/`deleted` product status.
3. **Prerender scope** — keep OgaBassey-hardcoded `generateStaticParams` (consistent with 18 existing files), or build the `PRERENDER_PRIORITY_MERCHANTS` config now (Jules's suggestion)?
4. **Blog prerender count** — all 392 posts, or a recent-N subset?

---

## Appendix — evidence index
- **Live crawl probes (Googlebot UA):** `/totally-made-up-slug-9z9z9` → 200 `index,follow` self-canonical (doorway trap); `/smartphones/bogus-product` → 200 `noindex` canonical=`usebaci.com`; `/smartphones?page=900` → 200 `noindex` canonical=`usebaci.com`.
- **Next 16 docs (v16.2.9):** `loading.js` Status Codes (2026-03-13); `proxy.js` (2026-05-13); `cacheComponents` / `generateStaticParams` (cacheComponents requires ≥1 param; `dynamicParams` disallowed with cacheComponents).
- **Google Search Central (2025/2026):** Crawl Budget (2025-12-19); Faceted navigation (2025-12-18); Sitemaps (2025-12-10); HTTP status meanings (2026-02-04).
- **Code refs:** `proxy.ts` (matcher, `RESERVED_STOREFRONT_SEGMENTS`, cache section); `lib/cached-data.ts` (`getCachedCategoryPageData` ~1652-1891, legacy fuzzy fallback ~1850); `lib/store-url.ts` (`buildStoreUrl` ~55-74); `lib/cached-storefront-product-index.ts`; `[category]/page.tsx`; `seo-utils.ts` (`getIndexableRobotsMetadata`, `getCanonicalStorefrontFilterSearchParams`); `[slug]/sitemap-data.ts`; `blog-post-page-content.tsx:174`; `cache-revalidation.ts` (tag invalidation).
- **PR #2479 reviews:** Codex (P1 layout tests, P2 cache breadth = real leak, P2 variant redirect) — all addressed; Jules (HIGH false positive, MEDIUM optional, LOW = variant redirect).
