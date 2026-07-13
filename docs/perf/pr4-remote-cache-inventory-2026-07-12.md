# PR 4 — Remote Cache Isolation & Failure Safety: `'use cache: remote'` Inventory

**Phase:** INVENTORY (classification only — no code changes)
**Date:** 2026-07-12
**Baseline:** `origin/main` (read-only; working tree ignored)
**Plan:** `docs/perf/storefront-runtime-reliability-plan-2026-07-09.md` §PR 4 (line ~473), decision rules §5 / §6.5, failure evidence §4.4
**Scope:** every remaining `'use cache: remote'` call site in `apps/web/src`

---

## 0. Method & headline numbers

- `git grep -l "use cache: remote" origin/main -- apps/web/src` returns **20 files**. Of these:
  - **12 files** contain **26 real `'use cache: remote'` directives** (the call sites classified below).
  - **5 files** only *mention* the string in comments / deliberately stay local (not call sites — see §6).
  - **3 files** are pure tests that pin directives (see §7).
- Cardinality measured live via Supabase PostgREST `count=exact` (service-role, read-only) on 2026-07-12.
- **No application-owned cache handler exists.** `git grep -nE "cacheHandlers|cache-handler|cacheHandler"` across `apps/web/next.config.ts` + `apps/web/src` returns **nothing**. Every one of the 26 sites therefore rides Next's **framework-default remote cache handler**.

### Framework default on `set()` rejection (plan §4.4)

Production traces show the managed Vercel `RemoteCacheHandler` returning **502/503 on `set()` *after* the route has already returned HTTP 200**; the framework turns that write rejection into an **unhandled promise rejection → Node `exit 128`**, which drops the whole function (and its warm local cache) — matching the still-unfixed, auto-closed `vercel/next.js#94751`. Caller `try/catch` cannot contain it because the write is fired by the framework outside the caller's awaited scope. The PR4 remedy is (a) stop making route correctness depend on high-cardinality/large remote writes, and (b) for the few datasets that still need sharing, an **application-owned `cacheHandlers.remote` whose failed `get()` = miss and failed `set()` resolves** (size limits, circuit breaker, telemetry, versioned invalidation).

### Measured cardinality (whole platform + dominant tenant)

| Entity | Count | Note |
|---|---:|---|
| merchants (all) | 75 | multi-tenant but single-dominant |
| merchants (published) | 15 | |
| categories (all) | 57 | top-level (`parent_id IS NULL`): 19 |
| products (active) | 1,367 | **1,333 are ogabassey** (97%) |
| products (all) | 2,517 | |
| merchant blog posts (published) | 532 | **all 532 are ogabassey** — matches plan's "526" |
| platform blog posts (published, `merchant_id IS NULL`) | **0** | platform blog currently unpopulated |
| blog_post_redirects | 16 | tiny |
| page_configs (published) | 74 | |
| ogabassey categories | 50 (top-level 12) | |

**Interpretation:** this is effectively a single-dominant-tenant workload (ogabassey), so per-merchant keys are *low cardinality* but per-merchant *payloads* (products, blog corpus) are the largest on the platform. The crawler-driven keys (arbitrary product/blog slugs) are the genuinely **unbounded** ones. `cacheLife` profiles from `next.config.ts`: `merchant`{stale300/rev60/exp3600}, `products`{300/300/86400}, `categories`{300/3600/86400}, `storefront-page`{60/300/3600}, `blog`{300/3600/86400}.

---

## 1. Summary classification table (26 sites)

Legend — **X-inst**: is cross-instance *sharing* actually required for correctness/cost? **Rec**: REMOVE = strip remote (local `use cache` or direct read; recompute is cheap / HTML is CDN-cached) · DEMOTE = local `use cache`, bounded life · KEEP = needs the future resilient adapter.

| # | File : function | Key varies on | Cardinality | Payload bound | Origin cost (miss) | X-inst | Rec |
|---|---|---|---|---|---|---|---|
| 1 | cached-data.ts : `getCachedMerchantById` | merchant_id | ~75 | 1 row ~2–4 KB | `merchants` PK `.single()` — indexed, <5 ms | no | **REMOVE** |
| 2 | cached-data.ts : `getCachedProducts` | merchant_id + options | low keys / **UNBOUNDED payload** | **no default limit** → all active parents+variants (100s of rows) | 2 queries, merchant_id/status indexed | no | **DEMOTE** +cap |
| 3 | cached-data.ts : `getCachedProductCanonicalRedirectTarget` | merchant_id + **productSlug** | **unbounded (crawler slugs)** | 1 row ~1 KB | `products` slug/id `.maybeSingle()` — indexed, <15 ms | no | **REMOVE** |
| 4 | cached-data.ts : `getCachedCategories` | merchant_id | ~75 | all cats (~57 max) ~10 KB | `categories` by merchant_id — indexed, <10 ms | no | **DEMOTE** |
| 5 | cached-data.ts : `getCachedCategory` | merchant_id + categorySlug | bounded (~57) + typos | 1 row small | `categories` slug `.single()` — indexed, <10 ms | no | **REMOVE** |
| 6 | cached-data.ts : `getCachedPageConfig` | merchant_id + pageSlug | — | Puck JSON (large) | `page_configs` `.single()` | **no consumers** | **REMOVE (dead code)** |
| 7 | cached-data.ts : `getCachedCategoryPageProductIds` | merchant_id + scope | bounded | **no SQL cap** → many UUIDs (100s–1000s) | `products` id-only by scope — indexed | no | **DEMOTE** +cap |
| 8 | cached-data.ts : `getCachedDashboardStats` | merchant_id | ~75 | stats obj small | `get_sales_dashboard_stats` RPC (**service-role**) | no (authed) | **DEMOTE** |
| 9 | cached-data.ts : `getCachedPlatformAnalytics` | startDate+endDate | **unbounded date ranges** | summary obj | `get_platform_analytics_summary` RPC (**service-role**, aggregate) | no (admin) | **DEMOTE** |
| 10 | cached-data.ts : `getCachedStorefrontLaunchProducts` | merchant_id | ~1 (ogabassey) | **50 products hydrated ~100–150 KB** | `products` limit 50 — indexed | **maybe** | **DEMOTE\*** (freshness-proof gated; else KEEP) |
| 11 | cached-data.ts : `getCachedStorefrontHomeProducts` | merchant_id + sort(2) | ~150 | **50 products hydrated ~100–150 KB**; `recent`=4 queries | `products` limit 50 — indexed | **maybe** | **DEMOTE\*** (freshness-proof gated; else KEEP) |
| 12 | blog-post-redirects.ts : `getBlogPostRedirect` | merchant + **sourceSlug** | **unbounded (crawler slugs)** | small | `getMerchantSafe`(local) + 2 reads on 16-row table — indexed | no | **REMOVE** |
| 13 | cached-categories.ts : `getCachedNavigationCategories` | merchant_id | ~75 | top-level cats ~19 `{name,slug}` <2 KB | `categories` parent_id null — indexed, <10 ms | no | **REMOVE** |
| 14 | cached-category-product-counts.ts : `getCachedCategoryProductCounts` | merchant_id + categories[] | keyed on array arg | Record<catId,count> bounded (~57) | paginated products (page 1000; ogabassey=2 pages) | no | **DEMOTE** |
| 15 | cached-content-link-rewrites.ts : `getCachedContentLinkRewrites` | merchant + blogSlugs[] + productSlugs[] | **high (per link-set)** | bounded by input | multi-query + N slug-RPCs | no | **DEMOTE** |
| 16 | cached-dead-content-links.ts : `getCachedDeadContentLinkSlugs` | merchant + blogSlugs[] + productSlugs[] | **high (per link-set)** | bounded by input | 3 parallel + N slug-RPCs | no | **DEMOTE** |
| 17 | cached-storefront-product-slug-resolution.ts : `getCachedStorefrontProductSlugResolution` | merchant + **productSlug** | **unbounded (crawler slugs)** | small | `get_merchant_product_slug_resolution` RPC (anon SECDEF) — ~2 ms | no | **REMOVE** |
| 18 | cached-storefront-product-slug-set.ts : `getCachedStorefrontProductSlugSet` | merchant_id | ~75 | `text[]` all slugs; ogabassey ~1,333 → ~50–100 KB (grows) | `get_merchant_product_slug_set` RPC (anon SECDEF) | **yes** | **KEEP** |
| 19 | cached-storefront-products-by-slugs.ts : `getCachedStorefrontProductsBySlugs` | merchant + slugs[] | small (pinned launch slugs) | few products | `products` `.in(slug)` — indexed | **yes** (tag invalidation) | ~~DEMOTE~~ **KEEP** (§8 correction) |
| 20 | monnify-bills.ts : `getCachedBillers` | categoryCode | small fixed set | biller list bounded | **external Monnify HTTP** (slow, rate-limited) | **yes** | **KEEP** |
| 21 | monnify-bills.ts : `getCachedBillerProducts` | billerCode | small fixed set | product list bounded | **external Monnify HTTP** (slow, rate-limited) | **yes** | **KEEP** |
| 22 | platform-blog.ts : `getPlatformBlogPost` | slug | 0 today | 1 post (content) | `blog_posts` platform slug — indexed | **yes** (tag invalidation) | ~~DEMOTE~~ **KEEP** (§8 correction) |
| 23 | platform-blog.ts : `getPlatformBlogListing` | category+tag+page+limit+offset | moderate | page ≤100 | `blog_posts` + count — indexed | **yes** (tag invalidation) | ~~DEMOTE~~ **KEEP** (§8 correction) |
| 24 | platform-blog.ts : `getPlatformBlogFeedPosts` | — (global) | 1 | ≤50 posts | `blog_posts` limit 50 — indexed | **yes** (tag invalidation) | ~~DEMOTE~~ **KEEP** (§8 correction) |
| 25 | platform-blog.ts : `getPlatformBlogSitemapPosts` | — (global) | 1 | ≤5000 slug rows (0 today) | `blog_posts` limit 5000 — indexed | **yes** (tag invalidation) | ~~DEMOTE~~ **KEEP** (§8 correction) |
| 26 | storefront-content/get-published-product-guide-posts.ts : `getPublishedProductGuidePosts` | merchant + productId | ~1,367 | ≤8 posts | features(local) + `blog_post_products` limit 8 — indexed | **no consumers** | **REMOVE (orphan)** |

**Totals — REMOVE: 8 · DEMOTE: 15 · KEEP: 3** (2 of the DEMOTE, #10/#11, are freshness-proof-gated and fall back to KEEP if the proof fails). *2026-07-13 correction (§8): #19 and #22–25 reclassified DEMOTE→KEEP, making the effective totals REMOVE: 8 · DEMOTE: 10 · KEEP: 8.*

---

## 2. Per-site evidence

### 2A. REMOVE — strip the remote layer (8)

Rationale bucket: indexed same-region read **< 50 ms** (plan's threshold), *or* the consuming HTML is already CDN-cacheable, *or* the key is crawler-unbounded (remote write economics are hostile — every typo mints a shared write), *or* the function is dead. None require cross-instance sharing for correctness. Target: local `'use cache'` (bounded) or a direct read.

- **`getCachedMerchantById`** (cached-data.ts:1024) — `merchants` primary-key `.single()`, ~2–4 KB, key = merchant_id (~75). Consumers are **non-storefront**: `lib/repair-notifications.ts`, `lib/repairs/notify-repair-status-change.ts` (background repair notifications). A PK read is trivially fast; sharing buys nothing. → REMOVE.
- **`getCachedProductCanonicalRedirectTarget`** (cached-data.ts:1520) — narrow active-product projection for the **proxy canonical-redirect preflight** (consumer `app/api/internal/product-canonical/[identifier]/route.ts`). Route-critical (decides 308 vs render) but the answer is deterministic per slug — a local cache/direct read is identical. Key varies on **arbitrary crawler `productSlug`** → unbounded remote keys. Indexed `slug`/`id` `.maybeSingle()`. → REMOVE.
- **`getCachedCategory`** (cached-data.ts:1658) — single category `.single()` by (merchant_id, slug), indexed, <10 ms. Consumed by **many** route-critical surfaces (category page, compare, PDP runtime, sitemap, semantic inventory). Bounded categories (~57) + crawler typos. Recompute cheap. → REMOVE. *(Note: returns `null` on error — a separate read-semantics concern owned by PR2.)*
- **`getCachedPageConfig`** (cached-data.ts:1694) — **DEAD CODE**: `git grep getCachedPageConfig origin/main` outside its own file = 0 hits. Safest possible removal (delete function or strip directive). → REMOVE.
- **`getBlogPostRedirect`** (blog-post-redirects.ts:31) — resolves blog 308 target; consumers `blog-catch-all-resolution.ts` + `blog-post-page-content.tsx` (route-critical redirect). Two indexed reads on a **16-row** `blog_post_redirects` table + `blog_posts` slug lookup, behind local `getMerchantSafe`. Key varies on **arbitrary crawler `sourceSlug`** → unbounded. → REMOVE.
- **`getCachedNavigationCategories`** (cached-categories.ts:35) — top-level nav (`{name,slug}`, ~19 rows, <2 KB), indexed. Consumers route-critical (shell nav): `storefront-content.tsx`, `storefront-shell-snapshot.ts`, ogabassey home. Tiny bounded fast read; sharing unnecessary. → REMOVE. **Flags:** no `cacheLife`; tag `'navigation-categories'` is merchant-agnostic (coarse invalidation); **swallows errors** (`return []` on error) — violates the plan's "transient failure never cached as empty" invariant and should be made fail-loud in the same change.
- **`getCachedStorefrontProductSlugResolution`** (cached-storefront-product-slug-resolution.ts:64) — anon SECDEF RPC `get_merchant_product_slug_resolution`, ~2 ms (plan-measured wrappers <2 ms). Consumers `api/internal/product-canonical` + `api/internal/slug-set` (proxy 308/404 decisions — route-critical). Key varies on **arbitrary crawler `productSlug`** → unbounded remote keys; this is precisely the "every cold unique route writes a remote entry" fanout the plan targets. Fast indexed RPC; answer is deterministic. → REMOVE (local `use cache`).
- **`getPublishedProductGuidePosts`** (storefront-content/get-published-product-guide-posts.ts:39) — **ORPHANED**: only referenced by its own test + a *negative* assertion in `get-cached-product-seo-link-data.test.ts` (which asserts the SEO path no longer calls it). No production consumer. → REMOVE (delete or strip). Also swallows errors (`return []`).

### 2B. DEMOTE — local `'use cache'`, bounded life (15)

Rationale bucket: recompute is non-trivial (multi-query, hydration, aggregation) so per-instance caching is worth keeping, but nothing requires the value to be *shared* across instances, and the consuming HTML/JSON tolerates per-instance cold misses. Moving off the framework remote handler removes the `exit 128` write path. Several need an added SQL cap.

- **`getCachedProducts`** (cached-data.ts:1083) — **UNBOUNDED payload**: no default `limit`, returns all active parent products + variants (ogabassey has 1,333 active) → potentially >100 KB remote writes. Consumers `api/storefront/products/route.ts` (JSON, not storefront HTML) + `dashboard/settings/faq` (authed). → DEMOTE **and add a hard row cap**.
- **`getCachedCategories`** (cached-data.ts:1597) — bounded (~57) small, but consumed widely (compare hub, category page, products link modules). Already wrapped by request-local `getStorefrontCategories` (`cache()`). Multi-consumer → local cache still useful. → DEMOTE (REMOVE also defensible).
- **`getCachedCategoryPageProductIds`** (cached-data.ts:2043) — **no SQL cap**; can return 100s–1000s of UUIDs for a broad category/collection. Consumers `get-cached-compare-category-inventory.ts`, `get-cached-category-scoped-semantic-inventory.ts` (route-critical inventory). → DEMOTE **and add a deterministic cap**.
- **`getCachedCategoryProductCounts`** (cached-category-product-counts.ts:63) — aggregates over paginated products (page size 1000; ogabassey = 2 pages) → non-trivial recompute; output Record bounded by #categories. Consumer `products-page-link-modules.ts` (pagination counts). Key varies on the `categories[]` argument (ensure stable ordering). → DEMOTE.
- **`getCachedContentLinkRewrites`** (cached-content-link-rewrites.ts:185) & **`getCachedDeadContentLinkSlugs`** (cached-dead-content-links.ts:37) — both keyed on `merchant + blogSlugs[] + productSlugs[]` (the exact link set of a blog post) → **high-cardinality keys**, so remote hit-ratio is poor *and* each miss does a multi-query + N-RPC fanout. Consumer `blog-content-link-resolution.ts`. Both already **fail-loud** (throw so the failure isn't cached). Local cache still helps within a render/instance. → DEMOTE (poor remote economics; correctness needs no sharing).
- **`getCachedStorefrontProductsBySlugs`** (cached-storefront-products-by-slugs.ts:47) — small bounded (pinned launch slugs), `products.in('slug', …)` indexed. Consumer ogabassey launch. Fail-loud (throws). → DEMOTE (REMOVE defensible).
- **`getCachedDashboardStats`** (cached-data.ts:2610) — `get_sales_dashboard_stats` RPC on a **service-role** client, consumed by `app/dashboard/actions.ts` (authenticated, not crawler HTML). No SEO/cross-instance need; remote write still risks `exit 128` on the dashboard path. → DEMOTE, short life.
- **`getCachedPlatformAnalytics`** (cached-data.ts:2634) — `get_platform_analytics_summary` RPC (**service-role**, aggregate, possibly slow) consumed by `api/admin/analytics` (admin only). Key varies on **arbitrary date ranges** (high cardinality) but tag is coarse (`'analytics'`, no date). Local cache absorbs the aggregate cost per instance. → DEMOTE.
- **`getCachedStorefrontLaunchProducts`** (cached-data.ts:3471) & **`getCachedStorefrontHomeProducts`** (cached-data.ts:3509) — **freshness-proof-gated** (see §2C caveat). ~50 hydrated products, ~100–150 KB — the **largest remote writes on the hottest crawler surface** (ogabassey home). `recent` sort does 4 sequential queries on a cold miss. Bounded (limit 50). → DEMOTE **only after** proving `revalidateProducts()` tag invalidation stays cross-instance-fresh against per-instance local caches; otherwise KEEP (§2C). **Blocker:** `cached-data.cache-directives.test.ts` currently *pins these two as remote* ("shared across instances") — that test + rationale must be updated as part of any demotion.
- **`getPlatformBlogPost` / `getPlatformBlogListing` / `getPlatformBlogFeedPosts` / `getPlatformBlogSitemapPosts`** (platform-blog.ts:165/202/302/330) — low-traffic, CDN-cacheable HTML/XML (`/blog`, `/blog/[slug]`, `feed.xml`, `sitemap.ts`), all indexed, and the dataset is **currently 0 published posts**. All fail-loud (throw). Remote sharing buys almost nothing here. → DEMOTE (feed/sitemap could even REMOVE). Listing key has moderate cardinality (category×tag×page).

### 2C. KEEP — genuinely needs the resilient adapter (3)

These are the "small set that still needs shared caching" the plan anticipates. They must move onto the **application-owned `cacheHandlers.remote`** (fail-open get/set, size cap, circuit breaker, telemetry, versioned/distributed invalidation), *after* a two-instance freshness proof — never the framework default.

- **`getCachedStorefrontProductSlugSet`** (cached-storefront-product-slug-set.ts:42) — **low cardinality** (one `text[]` per merchant, ~75 keys) with **very high reuse** (consulted by the proxy on *every* unknown-slug 404 decision), and already **fail-open** (`hasError → proxy must not 404`). Cross-instance sharing materially cuts origin RPC load, and per-merchant payload is bounded (grows with catalog — add a size guard; ogabassey ~1,333 slugs ≈ 50–100 KB). Best fit for KEEP. *(Local-demote is defensible since it's fail-open; decide on measured hit-rate.)*
- **`getCachedBillers`** (monnify-bills.ts:361) & **`getCachedBillerProducts`** (monnify-bills.ts:372) — the **only sites whose origin is NOT a fast indexed Supabase read**: they call the **external Monnify VAS API** (slow, rate-limited). Keys are a small fixed set of category/biller codes; custom long `cacheLife` (stale/revalidate/expire from `MONNIFY_DISCOVERY_*`). Sharing across instances directly reduces third-party calls and rate-limit exposure. Consumer `lib/vtu-pending-transaction.ts` (VTU/payments path — not storefront HTML, but process stability still matters). Clear KEEP.

---

## 3. Files that are NOT call sites (context only)

Comment-only mentions / deliberately-local — confirmed no `'use cache: remote'` directive on `origin/main`:

- `app/(storefront)/[slug]/(blog)/blog/[...catchAll]/blog-catch-all-resolution.ts` — comment; **consumes** `getBlogPostRedirect` (#12).
- `app/(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-page-content.tsx` — comment; consumes `getBlogPostRedirect`.
- `app/(storefront)/ogabassey/ogabassey-home-hero-shell-data.ts` — comment; **transitively consumes** the remote launch/home reads (#10/#11) via `loadOgabasseyLaunchProducts`; has its own 500 ms fail-open budget.
- `lib/storefront-content/get-published-cluster-posts.ts` — **deliberately local** (`'use cache'`); the doc-block records it was the original **~400 KB unbounded** remote entry demoted in PR #3017 (now SQL-bounded to ≤64 rows). Reference example of the target end-state.
- `lib/storefront-product/get-cached-product-seo-link-data.ts` — **deliberately local** (`'use cache'`); comment explicitly keeps it "off `use cache: remote`".

---

## 4. Test files that pin directives (update these alongside code)

- **`lib/cached-data.cache-directives.test.ts`** — the load-bearing guard. It asserts:
  - local-only (must stay `'use cache'`): `getCachedMerchant`, `getCachedMerchantByDomain`, `getCachedFeatureSettings`, `getCachedProductLcpHint`, `getCachedProductWithDetails`, `getCachedCategoryPageShellData`.
  - **remote (must stay `'use cache: remote'`): `getCachedStorefrontHomeProducts`, `getCachedStorefrontLaunchProducts`.** → Demoting #10/#11 **requires editing this test** and its "shared across instances" rationale, backed by the PR4 step-4 freshness proof.
- **`lib/cached-storefront-product-index.test.ts`** — references the remote product-index directives.
- **`lib/storefront-product/get-cached-product-seo-link-data.test.ts`** — asserts the SEO path is not remote and does **not** call `getPublishedProductGuidePosts` (evidence #26 is orphaned).

---

## 5. Proposed implementation order (cheapest-safest first; each independently shippable)

Each slice starts from latest `origin/main`, is production-observable alone, and follows the plan's rollback rule (revert the caller first). Order maximizes risk-reduction-per-diff.

**Slice A — Dead/orphan removal (zero consumer risk).**
Remove `getCachedPageConfig` (#6, no consumers) and `getPublishedProductGuidePosts` (#26, test-only). Cannot regress production HTML. Update the two tests. *Smallest, safest, ship first.*

**Slice B — Unbounded-key proxy reads → local (highest write-fanout reduction).**
`getCachedStorefrontProductSlugResolution` (#17) and `getCachedProductCanonicalRedirectTarget` (#3): swap remote→local `use cache`. These carry the worst remote-write economics (one shared write per crawler URL) and are proxy-route-critical, so removing their remote writes gives the biggest cold-crawler stability win with a deterministic, unchanged answer. Add the 100-unique-route concurrency assertion from PR1's harness.

**Slice C — Fast bounded single-row/nav reads → local.**
`getCachedMerchantById` (#1), `getCachedCategory` (#5), `getCachedNavigationCategories` (#13, + make fail-loud + add `cacheLife`/merchant-scoped tag), `getBlogPostRedirect` (#12). All <15 ms indexed reads; trivial recompute.

**Slice D — Hydrated/aggregate storefront reads → local, with SQL caps.**
`getCachedProducts` (#2, +row cap), `getCachedCategoryPageProductIds` (#7, +cap), `getCachedCategories` (#4), `getCachedCategoryProductCounts` (#14), `getCachedStorefrontProductsBySlugs` (#19). Group by surface (products-list vs category-page) so each is separately observable.

**Slice E — High-cardinality blog-link helpers → local.**
`getCachedContentLinkRewrites` (#15), `getCachedDeadContentLinkSlugs` (#16). Poor remote hit-ratio today; both already fail-loud, so demotion is low-risk.

**Slice F — Non-storefront/admin + platform-blog → local.**
`getCachedDashboardStats` (#8), `getCachedPlatformAnalytics` (#9), and the 4 platform-blog reads (#22–#25). Low traffic, CDN-cacheable or authed; batch.

**Slice G — Home/launch demotion (freshness-proof gated).**
`getCachedStorefrontLaunchProducts` (#10), `getCachedStorefrontHomeProducts` (#11). Requires the PR4 step-4 two-instance freshness proof (that `revalidateProducts()` tag busting stays correct against per-instance local caches) **plus** updating `cache-directives.test.ts`. If the proof fails, route these two into Slice H (KEEP) instead. Highest-traffic surface → change last among the demotions, with the most measurement.

**Slice H — Build the resilient adapter, then move the KEEP set (last, largest lift).**
Implement application-owned `cacheHandlers.remote` (failed `get()` = miss, failed `set()` resolves, size limits, circuit breaker, telemetry, versioned/distributed invalidation) in `next.config.ts`. Prove two-instance freshness. Then migrate `getCachedStorefrontProductSlugSet` (#18), `getCachedBillers` (#20), `getCachedBillerProducts` (#21). Finally, if the framework-owned rejection still exits after all *application* remote usage is gone, prepare the minimal Vercel/Next repro (plan PR4 step 5).

---

## 6. Open questions

1. **Home/launch (#10/#11) freshness:** does `revalidateProducts()` tag invalidation propagate to per-instance local caches well enough to demote, or is the "shared across instances" rationale in `cache-directives.test.ts` load-bearing? Needs the two-instance freshness experiment before Slice G.
2. **Slug-set (#18) KEEP vs DEMOTE:** measure the real proxy hit-rate/reuse. If per-instance local caching already yields a high hit-rate (single-dominant tenant), it could DEMOTE and shrink the KEEP set to just the two Monnify reads.
3. **`getCachedProducts` (#2) cap:** do any consumers depend on the full unbounded list, or is a deterministic cap safe for both the JSON API and the FAQ dashboard page?
4. **Platform blog (#22–#25):** currently 0 published posts — is a platform-blog launch imminent? That would raise traffic/cardinality and could argue for KEEP on the listing/sitemap rather than DEMOTE.
5. **Fail-soft reads:** `getCachedNavigationCategories`, `getCachedMerchantById`, `getCachedCategory`, `getPublishedProductGuidePosts` swallow errors (`return []`/`null`). Fix under this PR, or defer to PR2's `StorefrontReadResult` read-semantics work? (They violate the "never cache transient absence" invariant regardless of tier.)
6. **Same-region assumption:** the <50 ms REMOVE threshold assumes Vercel functions and Supabase are co-located. Plan §3 measured 2–15 ms; confirm region pinning holds for the deployment PR4 lands on.
7. **Adapter invalidation:** must the resilient `cacheHandlers.remote` interoperate with existing `cacheTag`/`revalidateTag`/`revalidateProductsReliable` flows (incl. the standalone CLI import worker's Bearer revalidation endpoint)? That constrains the adapter's invalidation design.

---

## 8. Corrections (2026-07-13 — PR4b Codex review, PR #3108)

**Sites #19 and #22–#25 are reclassified DEMOTE → KEEP.** Both were demoted in
the first PR4b push and reverted to `'use cache: remote'` after Codex review
verified a freshness-contract violation this inventory's cross-instance
analysis missed:

- **#19 `getCachedStorefrontProductsBySlugs`** feeds the pinned launch
  carousel on the ogabassey home page. Its correctness depends on
  `revalidateProducts()` tag busting reaching **every** instance when a
  merchant edits a pinned product.
- **#22–#25 `getPlatformBlog*`** are busted by the admin blog routes via
  `revalidateTag` on the `PLATFORM_BLOG_*` tags (see `cache-revalidation.ts`)
  when a post is edited, unpublished, deleted, or renamed.

**The classification lesson:** `revalidateTag`/`revalidatePath` only
propagates cross-instance through the **shared** remote store. A local
`'use cache'` entry on another instance never sees the bust and serves stale
data until its `cacheLife` revalidate window expires. Therefore the "X-inst"
column must not only ask *"is cross-instance sharing needed for cost?"* — it
must also ask *"does any invalidation flow (`revalidateTag`, admin mutation,
import worker) expect this entry to disappear everywhere at once?"* Any site
whose freshness contract depends on tag/path invalidation propagation needs
the SHARED store (KEEP), regardless of payload size or key cardinality.

Both corrected sites join the Slice H (PR4d) resilient-adapter migration set
alongside #18/#20/#21 — they must move onto the application-owned
`cacheHandlers.remote` (fail-open get/set, size caps, circuit breaker,
versioned invalidation), never stay on the framework default long-term.

**Re-audit of the sites that remain demoted (D/E/F):** none of the other 8
demoted sites has an invalidation-propagation contract — their consumers
either tolerate `cacheLife`-bounded per-instance staleness (categories,
counts, IDs+exact-count, dashboard/analytics aggregates) or fail open per
request (content-link helpers). #7's pagination-truth fix (exact head-count +
per-request tail window) additionally removes the truncation the cap
introduced.
