# OgaBassey — Crawl-Budget, Hard-404, and Blog CWV Execution Plan

> Status: **draft for review (rev 15).** PR #2479 (PDP static-hero LCP) **merged 2026-06-14** (squash `eaca402662`); live-verified LCP ~1.06s (Chrome trace) / 2.5s (DebugBear, larger-image PDP), CLS 0.00, resume-mismatch canary clean. This document specifies the follow-on work as reviewable PRs **B through H** (PR-F was resolved as a data-only fix, 2026-06-14; see §7 for sequencing). Every claim here is backed by a live probe, a PSI/DebugBear measurement, an official-doc citation, or a code reference (see Appendix).
>
> **Rev 15 — execution protocol added:** implementation now explicitly requires `superpowers:executing-plans`, an isolated worktree/branch per PR via `superpowers:using-git-worktrees`, and TDD for every code behavior change via `superpowers:test-driven-development` (RED before production code, GREEN before refactor). — §0.1.
>
> **Rev 14 — scope-line fix:** the status line undercounted scope ("four PRs B–E"); now reads "PR-B through PR-H (PR-F resolved data-only)" to match §7. No other findings (review was otherwise clean).
>
> **Rev 13 — two review findings:** (P1) PR-G.2 corrected — the named replacement (`getMerchantByIdentifier`/`getCachedMerchant*`) still uses service role internally (`cached-data.ts:550, 687`), so it would NOT satisfy the no-service-role rule; PR-G.2 now mandates the anon RLS `createPublicClient()` (`@/lib/supabase/public`) and a test asserting no service-role-backed helper is used. (P3) PR-G.1 now spells out the call-chain change — `toOgabasseyProduct` is called inside `renderTemplateProductPage` (`page.tsx:291`), which lacks a currency param, so add `payoutCurrency` to its signature (`:278-284`) + pass it at the call site (`:1269`). — §G.1/§G.2.
>
> **Rev 12 — two review findings:** (P1) PR-G.2 now requires the OG-image routes to **drop `createAdminClient()`** (both query public `merchants`/`products` by service role — violates `.ruler/01-critical-rules.md:5`) and use the public/cached storefront data path, not just fix the `.eq('slug', …)` resolver. (P2) PR-H now requires replacing the single unscoped `next/image` `<Image preload>` (`critical-shell.tsx` ~159, hardcoded `profile/desktop`) with `getImageProps()` + `<picture>/<source>` art direction, with a test asserting no leftover unscoped desktop preload survives the breakpoint split — §G.2/§H.2/§H.3.
>
> **Rev 11 — PR-H added (audited from another agent's plan):** folded in the PDP LCP image preload↔render alignment work, but **corrected the fix direction** — the source plan flattened everything to `profile/desktop` (fixed 640px), which downgrades high-DPR mobile from the intended 1080 (`mobile-header`) → softer hero + a degenerate srcset. PR-H instead aligns preload+render **per breakpoint** (mobile=1080, desktop=640), gated on verifying the current render size + hero visual QA, and notes the deeper lever is cache-hit-rate/image-route speed (loadDuration ≈ 1.3s) — §PR-H/§7.
>
> **Rev 10 — PR-E P2 + PR-G + open_box decided:** (P2) PR-E's cache-partitioning step is now specified, not hand-waved — the `x-baci-metadata-cache-bucket` header + `__baci_metadata_cache_bucket` query-param partition + `Vary` already exist and still failed, so the plan now requires picking a mechanism (preferred: the query-param cache key, robust to Next/Vercel stripping `Vary`) and PROVING it survives to the edge, plus both-order (browser↔Googlebot) cross-contamination tests — §E.3/§E.4. Added **PR-G** (metadata code hardening: visible⇄SEO currency consistency + OG-image merchant resolution) at the owner's request — §PR-G/§7. `open_box→RefurbishedCondition` **decided: by design** (UI says "Open Box", Google gets Refurbished) — §8/§PR-F.3.
>
> **Rev 9 — PR-F resolved:** the DZD/"My New Business" metadata leak was traced (5-agent + Supabase + live) to a **DATA** bug, not code — the OgaBassey merchant row held un-onboarded Algerian signup defaults (`business_name='My New Business'`, `payout_currency='DZD'`, `country='DZ'`). Fixed via owner-approved data update → live-verified site-wide (DZD→NGN, seller→Ogabassey, double-suffix self-resolved, ₦690,000 unchanged); 0/15 other published merchants affected. PR-F now documents the real root cause + optional hardening (publish-time validation, visible⇄SEO currency consistency, latent OG-image) — §PR-F.
>
> **Rev 8 — new bug intake:** added **PR-F — PDP metadata/SEO value correctness** (HIGH): live-verified the metadata layer emits `DZD` currency (×34, NGN ×0) and `"My New Business"` seller (×24) on `/laptops/macbook-air-m1-2020` while the visible payload is correct (₦690,000) — the metadata path is fed a fallback/default merchant instead of the resolved OgaBassey one (two-data-path divergence; same root as PR-E's title "My New Business"). Sequenced FIRST (data integrity, no proxy gate); `open_box→RefurbishedCondition` flagged as an owner decision — §PR-F/§7/§8.
>
> **Rev 7 — sixth review round:** (P2) split PR-E verification into two gates — **local origin rendering** (the `<title>`/head correctness, testable locally) vs **preview/live CDN partitioning** (`x-vercel-cache` MISS/HIT + bot-bucket variant, which local `next start` cannot reproduce per §1) — §E.3/§E.4. No P1 blockers.
>
> **Rev 6 — fifth review round (verified against code + live):** (P1) the `legacy_redirect` 308 is now **storefront-mode aware** — `buildProductRedirectPath` returns an origin-root path with NO merchant prefix, so a naive `new URL(path, request.url)` drops `/ogabassey` in root-domain path mode; the snippet now prepends `/${merchantSlug}` for path mode only, and the `Location` assertion requires `https://usebaci.com/ogabassey/...` — §3.2/§3.7; (P2) added a **hard gate** that the `usebaci.com` canonical fix must NOT swap `buildRequestScopedStoreUrl` (`headers()`, dynamic) into the prerendered PDP `generateMetadata` (`page.tsx:878` uses static `buildStoreUrl` — already correct for custom domains) or it undoes #2479's static shell; verification added — §3.5; (nit) #2479 is now described as MERGED throughout (§1, §7). **NEW: added PR-E — Bot metadata delivery (S1)**: live-verified the PDP still ships a generic `<title>Ogabassey</title>` FIRST + a malformed resolved title (`| Ogaba… | My New Business`); corrected §1's over-claim that #2479 fixed it.
>
> **Rev 5 — fourth review round (verified against code):** (P1) the `legacy_redirect` 308 now builds an **absolute** URL via `new URL(targetPath, request.url)` — `buildProductRedirectPath` returns a relative Route in prod (`build-product-redirect-path.ts:11`) and `NextResponse.redirect` throws on a relative URL; added per-URL-shape `Location` assertions — §3.2/§3.7; (P2) `buildHardStatusStorefrontResponse` now sets `Content-Type: text/html; charset=utf-8` explicitly (a string body defaults to `text/plain`, which `nosniff` would block from rendering) + test assertion — §3.2/§3.7; (P3) the `usebaci.com` leak is reframed as **builder-determined** (`buildStoreUrl` static fallback vs `buildRequestScopedStoreUrl` request-host) rather than store-type-specific, with a note to document the probed host per URL shape — §3.5; (nit) added the missing `## 4. PR-C — Sitemap hygiene` heading.
>
> **Rev 4 — third review round (verified against code):** (P1) the slug-state machine now has an explicit **`legacy_redirect` → 308 FIRST** state — an archived row with an active parent must permanent-redirect to the canonical parent, never 410 (matches `getCachedLegacyProductRedirectTarget` / `product-page-resolution.ts:238`); 410 is reserved for archived/deleted with **no** active replacement — §3.2/§3.7/§8; (P2) hard statuses go through a dedicated **`buildHardStatusStorefrontResponse`** helper that applies CSP/security/Vary and sets `no-store` LAST with an early return (a bare `NextResponse` skips security headers; naive `applySecurityHeaders` lets the cache section overwrite `no-store`) — §3.2/§3.7; (P2) variant-308 needs a **cached per-product variant-axes signal** (slug-set membership is insufficient — validity depends on axes/values), fail-open — §3.8; (P3) reworded the `usebaci.com` root cause — `getCachedMerchant`/`getCachedMerchantByDomain` already hydrate `custom_domain`, so the fix is a call-site audit (raw-row bypasses + request-host canonicals), NOT a blanket backfill — §3.5; (P3) clarified `preload` **xor** `fetchPriority` on the single hero Image — §5.
>
> **Rev 3 — second review round (verified against code + Next 16.2.9 docs):** (P1) the proxy existence check is now a **guarded branch within the existing flow, not a top-level early return** (an early `NextResponse.next()` would bypass CSRF/rate-limit/rewrites/headers) — §3.2; (P1) **hard 404/410 responses set `Cache-Control: no-store`** so a transient stale-set miss can't become a cached false 404 — §3.2/§3.7; (P2) **pagination hard-404 moved into PR-B** (it needs the proxy + a cached page-count signal) with its own invalidation contract — §3.6; PR-C is now **sitemap-only**; (P3) removed stale "Node-runtime branch/move" wording (§3.7); (P3) `revalidateTag` examples now include the cacheLife-profile arg (§3.3).
>
> **Rev 2 (prior round):** proxy runs Node not Edge (§3.2); slug-set invalidation is a hard gate (§3.3); matcher gates GET/HEAD HTML + expanded test matrix (§3.2/§3.7); blog prerender gated on hoisting the hero out of Suspense + `draftMode()`, hint via `<Image preload>`/`fetchPriority` (§5); `usebaci.com` canonical broadened to 58 `buildStoreUrl` call sites (§3.5).

---

## 0. Context & how we got here

The PDP LCP investigation revealed that OgaBassey's storefront was **deliberately forced fully-dynamic** by three `connection()` guards + a proxy `no-store`, all added (2026-05-30/31) to dodge a Next 16 PPR resume/metadata-boundary bug. That bug was later fixed by `patches/next@16.2.9.patch` (PR #2436, upstream `vercel/next.js#94630`), which made the guards vestigial. PR #2479 removes them + adds `generateStaticParams` so the PDP hero ships in the static shell (LCP ~3.9s → ~1.3s, verified locally).

While auditing, we measured the blog CWV for the first time and swept the site for crawl-budget waste. This plan captures that work.

**Guiding constraint from the owner:** conserve crawl budget as much as possible.

---

## 0.1 Execution protocol for implementation

> **For agentic workers:** use `superpowers:executing-plans` to execute this plan task-by-task. Use `superpowers:subagent-driven-development` instead when subagents are available and the platform supports review checkpoints.

- **Isolated worktree required:** before writing code, run the `superpowers:using-git-worktrees` workflow. Detect existing isolation first; otherwise create or switch to an isolated implementation worktree/branch. Treat this planning worktree as review context unless the owner explicitly says to implement in it.
- **One PR at a time:** keep PR-B through PR-H changes isolated by branch/worktree. Do not mix crawl-budget proxy work, metadata fixes, blog CWV work, and PDP image delivery changes in one branch.
- **TDD required for code behavior changes:** use `superpowers:test-driven-development` for every implementation or bugfix. Write the failing test first, run it and confirm the expected RED failure, implement the minimal GREEN change, run the test to confirm pass, then refactor while keeping tests green. PR-F is already resolved as data-only; TDD only applies if optional hardening is implemented.
- **Current-source verification required:** before implementation, re-check the current repo patterns and relevant official docs for the touched surface (especially Next.js Image/PPR/proxy behavior, Vercel cache behavior, Supabase RLS/client usage, and Search Central SEO guidance). Current docs/source outrank this plan if they conflict.
- **Protected-file approval gate:** do not edit `apps/web/src/proxy.ts` until the owner explicitly approves the specific proxy change being implemented.
- **Verification gates:** run the targeted test(s) named in each PR section, then the repo-required quality gates for code changes (`pnpm turbo lint`, `pnpm turbo typecheck`, and the relevant `pnpm turbo test` scope; full `pnpm turbo test` before merge when practical). Do not use cloud-building deploy commands; production deploys must follow the repo's prebuilt-artifact flow.

---

## 1. PR #2479 — PDP static-hero LCP (✅ MERGED 2026-06-14, squash `eaca402662`) — reference only

Implemented, reviewed, merged; included here so reviewers see the full arc.

- **Change:** remove 3 `connection()` guards (page + `[slug]/layout` + `(catalog)/(pdp)/layout`); add `generateStaticParams` (50 newest active OgaBassey PDPs; long tail on-demand) + the canonical `categories:category_id` index select; lift the PDP/category `no-store` → cacheable, **scoped to confirmed-public clean canonical URLs only** (see review fixes).
- **Verified live post-merge (mobile Slow-4G/4×CPU):** prerendered PDP LCP **1.06s** (Chrome trace, samsung PDP) / **2.5s** (DebugBear, alienware PDP — larger image, delivery-bound), CLS 0, hero preloaded in the static shell; resume-mismatch canary clean (no `1617769459` digest, browser + Googlebot). Field CrUX p75 still ~4.6s (pre-merge 28-day window; updates by ~mid-July).
- **⚠️ Did NOT fix the generic-title bug** (corrected — earlier draft over-claimed this): live bot-UA HTML still has TWO `<title>` tags — generic `<title>Ogabassey</title>` **first**, resolved product title second (first-title-wins → crawlers can take the generic one). Robots + canonical ARE correct. Tracked as **PR-E (S1)** below.
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

### 3.2 Mechanism (concrete) — corrected per review

**RUNTIME CORRECTION (review P1):** an earlier draft said proxy is "Edge by default" and proposed "scoping the PDP/category branch to the Node runtime." That is **wrong**. In Next 16 `proxy.ts` runs the **`nodejs` runtime** (confirmed in installed `next@16.2.9`; our `proxy.ts` declares no `runtime` override) and the runtime is **not configurable** for proxy. So this is a **Node-proxy implementation**, not a runtime branch — there is no Edge limitation to work around.

`NextResponse` extends the Web Response API, so it supports any status incl. **410** (which `rewrite/redirect/json` don't cleanly expose):

```ts
// apps/web/src/proxy.ts  (PROTECTED FILE — runs on the Node runtime)
// PLACEMENT (review P1): insert this as a guarded BRANCH inside the existing
// proxy flow, AFTER merchant/route resolution and BEFORE the cache-header
// section — NOT a top-level early return. Only a confirmed-missing product
// short-circuits; every other request MUST fall through to the rest of proxy
// (CSRF, rate-limit, custom-domain rewrites, merchant/security/cache headers).
if (isHtmlDocumentNavigation(request) && routeType === 'storefront') {
  const slug = matchProductOrCategorySlug(pathname, hostname, routeType); // string parse
  if (slug) {
    // state is a discriminated union, NOT a bare string — the legacy_redirect
    // case must carry its redirect target.
    const state = await getSlugState(merchantId, slug);   // O(1) cached set membership (+ legacy-redirect target)
    // 308 FIRST (review P1): an archived row WITH an active parent must
    // permanent-redirect to the canonical parent — it HAS a replacement, so it
    // must never 410. Mirrors the live runtime ordering
    // (getCachedLegacyProductRedirectTarget → product-page-resolution.ts:238).
    // state.targetPath is an ORIGIN-ROOT relative path with NO merchant prefix
    // (buildProductRedirectPath returns e.g. `/phones/iphone` in prod,
    // build-product-redirect-path.ts:7). Two traps:
    //   1. NextResponse.redirect requires an ABSOLUTE URL or it throws.
    //   2. `new URL('/phones/iphone', request.url)` DROPS the merchant prefix in
    //      root-domain path mode: usebaci.com/ogabassey/... → usebaci.com/phones/...
    // So the helper must be STOREFRONT-MODE aware — prepend `/${merchantSlug}`
    // only for path mode (custom-domain & subdomain carry the tenant in the host):
    if (state.kind === 'legacy_redirect') {
      const prefix = routingMode === 'path' ? `/${merchantSlug}` : '';
      return NextResponse.redirect(new URL(`${prefix}${state.targetPath}`, request.url), 308);
    }
    // Hard statuses go through a dedicated helper (buildHardStatusStorefrontResponse,
    // below): a bare NextResponse skips CSP/security/Vary, and routing a
    // product-shaped path through applySecurityHeaders would let the cache
    // section overwrite no-store with s-maxage (caching a false 404). The helper
    // applies security headers, sets no-store LAST, and the branch returns early
    // so no cache branch runs.
    if (state.kind === 'missing')      return buildHardStatusStorefrontResponse(404, notFoundHtml, request, pathname, userAgent, isLocal, hostname);
    if (state.kind === 'discontinued') return buildHardStatusStorefrontResponse(410, goneHtml,     request, pathname, userAgent, isLocal, hostname);
    // 'present' | 'unknown' → do nothing; fall through to normal flow (fail open).
  }
}
// ... existing proxy flow continues (rewrites, headers, cache section) ...
```

**Hard-status construction (review P2 — required).** Do NOT return a bare `new NextResponse(html, { status })` for 404/410 — that bypasses the CSP, security headers, and storefront `Vary` that every other storefront response carries via `applySecurityHeaders` (`proxy.ts:2320`). And do NOT route a product-shaped hard status *naively* through `applySecurityHeaders`, because its cache section (`proxy.ts:2442-2464`) matches `isStorefrontProductPagePath` and would **overwrite** `no-store` with `STOREFRONT_DOCUMENT_CACHE_CONTROL` (`s-maxage=300`) — edge-caching a false 404. Use a dedicated helper that applies the security/Vary core, then sets `Cache-Control: no-store` LAST, and have the branch **return early** so the cache section never runs (mirrors the correct ordering already at `proxy.ts:2459-2463`):
```ts
function buildHardStatusStorefrontResponse(
  status: 404 | 410, html: string, request: NextRequest,
  pathname: string, userAgent: string, isLocal: boolean, hostname?: string,
): NextResponse {
  const response = new NextResponse(html, { status });
  // Set Content-Type explicitly: a string body defaults to text/plain;charset=UTF-8,
  // and with the security core adding X-Content-Type-Options: nosniff the browser
  // would refuse to render the HTML 404/410 page.
  response.headers.set('Content-Type', 'text/html; charset=utf-8');
  applyStorefrontSecurityCore(response, pathname, userAgent, isLocal, request, hostname); // CSP + security + Vary, NO cache branches
  response.headers.set('Cache-Control', 'no-store');  // LAST — nothing can overwrite it
  return response;                                     // early return — caller must not fall through to the cache section
}
```

**Matcher gating (review P1/P2 — required):**
- **Do NOT early-return for non-HTML** — that would bypass the rest of `proxy.ts` (API CSRF/rate-limit, custom-domain rewrites, merchant headers, security/cache headers). Gate only the existence-check branch; fall through otherwise.
- Run only on **GET/HEAD HTML document navigations**, excluding RSC/prefetch (`RSC`, `Next-Router-Prefetch` headers / `_rsc` param), image-metadata/OG routes, and non-GET methods. The proxy already has this style of guard for blog metadata/image routes (`proxy.ts:1371`) — reuse it. Running on RSC/prefetch would 404 navigations Next expects to succeed.
- **Hard-status responses must go through `buildHardStatusStorefrontResponse`** (above) — applies CSP/security/Vary and sets `Cache-Control: no-store` LAST with an early return, so product-shaped paths can't get public `s-maxage` from the cache section (`proxy.ts:2442-2464`) and can't lose security headers. Tested for status, `no-store`, CSP, and storefront `Vary`.

- **308 (legacy_redirect — checked FIRST):** an archived row whose `parent_product_id` resolves to an **active** parent slug (`getCachedLegacyProductRedirectTarget`, `cached-data.ts:1530`) permanent-redirects to that parent. These slugs HAVE a replacement, so they must 308 — never 410 — and must NOT regress the existing `permanentRedirect` (`product-page-resolution.ts:238`).
- **404** for typos / unknown slugs / never-existed.
- **410** ONLY for `archived`/`deleted` products with **no active replacement parent** (status flag AND no legacy redirect target). Default to 404 on any uncertainty — a wrong 410 de-indexes a live product (see 3.3 invalidation gate).

### 3.3 Existence signal + the invalidation contract (review P1 — hard gate)

There is **no dedicated slug-set cache today**. Proxy runs Node (3.2), so the cached set is reachable from the proxy — implementation options (spike which actually works from the proxy context before committing): (a) call a `'use cache'` slug-set function directly, or (b) `fetch` a small internal cached route handler that returns the set. Either way it is a **membership test, not a row fetch** ("avoid fetching full content").

**Invalidation is the load-bearing risk (review P1): a stale slug set hard-404s/410s a LIVE product.** The current `revalidateProducts()`/`revalidateCategories()` (`cache-revalidation.ts:62,97`) invalidate merchant/index/detail/page tags — there is **no slug-set tag today**. Contract before any hard-status rollout:
1. Tag the new `getCachedStorefrontProductSlugSet(merchantId)` / `getCachedStorefrontCategorySlugSet(merchantId)` with a **dedicated tag** (e.g. `product-slug-set-${merchantId}`, `category-slug-set-${merchantId}`), NOT a shared/implicit one.
2. Add `revalidateTag('product-slug-set-${merchantId}', 'products')` to **every** product-mutation path (publish, unpublish, archive, delete, slug change) in `cache-revalidation.ts`, and `revalidateTag('category-slug-set-${merchantId}', 'categories')` for categories. (Next 16 + repo style require the cacheLife-profile second arg — see `cache-revalidation.ts:63`.)
3. **Mutation-path tests** proving: publish a product → its slug is in the set (no 404); unpublish/archive → removed (404/410) — i.e. tests that exercise the revalidate call, not just the set builder.
4. **Fail-open default:** if the set is unavailable/empty/errored, do NOT 404/410 — fall through to the existing render (no worse than today). Default status 404; reserve 410 for the explicit archived flag.

Fallback (defense-in-depth, not needed at 1,237 SKUs): a Bloom filter for pure-CPU negative checks; false positives fall through to the existing `notFound()` `noindex`-200 path.

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

### 3.5 `usebaci.com` canonical leak (review P3 — broaden scope)

**Verified live:** bogus PDP and pagination canonicalize to `https://usebaci.com/...`. **Mechanism:** `buildStoreUrl` (`lib/store-url.ts` ~55-74) returns `https://{slug}.usebaci.com` when `merchant.custom_domain` is null.

**Note — hydration already happens (review P3 — don't over-promise a backfill):** `getCachedMerchant` (`cached-data.ts:643-660`) and `getCachedMerchantByDomain` (`:799-806`) ALREADY hydrate `custom_domain` from the active primary domain (`domains` where `is_primary` + `status='active'`). Call sites that resolve the merchant through these (e.g. the PDP via `getRequestScopedMerchant`) already have `custom_domain` for custom-domain merchants — so a "populate `custom_domain`" backfill would NOT fix the cited bogus-PDP/pagination leak. **The determinant is the URL BUILDER, not the store type:** `buildStoreUrl` (`store-url.ts:55`) statically falls back to `{slug}.usebaci.com` when `custom_domain` is null, whereas `buildRequestScopedStoreUrl` (`store-url.ts:77`) preserves the live request host across custom-domain, subdomain, and root-domain path mode. So the leak appears wherever a canonical/`og:url` is built with `buildStoreUrl` while `custom_domain` is absent — i.e. subdomain-only stores (no primary-active `domains` row to populate, so a backfill can't help — only request-host context can) **or** any call site passing a non-hydrated merchant row. When verifying, document the probed host + expected canonical per URL shape rather than asserting a single store type.

**Scope:** `buildStoreUrl` is used in **58 files** — PDP metadata, blog index + post, home/content, JSON-LD generators. **Fix (audit, NOT blanket backfill):** (a) audit the `buildStoreUrl` call sites that BYPASS hydration — raw `from('merchants').select(...)` rows / partial selects (e.g. `dashboard/agentic/data.ts`, `api/feed/openai/route.ts`) — and route them through hydrated merchant data; (b) for public canonical / `og:url` / JSON-LD URL generators, route through `buildRequestScopedStoreUrl` (live host) so subdomain-only stores canonicalize to the request host instead of `{slug}.usebaci.com`. Changes indexed canonical signals across the whole storefront — verify host resolution on a preview and check the blog/home canonicals too.

**⚠️ Hard gate (review P2 — must NOT regress #2479's static shell):** the prerendered PDP `generateMetadata` builds its canonical STATICALLY via `buildStoreUrl(merchant)` (`page.tsx:878`), which is what keeps the route prerenderable. `buildRequestScopedStoreUrl` requires `await headers()` — a request-time, dynamic-rendering opt-in — so swapping it into the **prerendered PDP** `generateMetadata` would force the route dynamic and UNDO the static-hero LCP win. For custom-domain merchants the canonical is **already correct** under `buildStoreUrl` (custom_domain is hydrated; verified live: self-canonical `https://ogabassey.com/...`), so leave the PDP path on `buildStoreUrl`. Apply the `buildRequestScopedStoreUrl` switch ONLY to non-prerendered / already-dynamic surfaces (blog, home, the JSON-LD/visible render that already does `buildRequestScopedStoreUrl(merchant, await headers())` at `page.tsx:1174`) and subdomain-only stores (not prerendered anyway). **Verification:** after the canonical patch, confirm the PDP still prerenders — build output marks the route static, the hero + canonical are in the static head, and the live shell returns `x-vercel-cache: HIT`; assert NO `headers()` was introduced into the prerendered PDP `generateMetadata`.

### 3.6 Pagination hard 404 (moved into PR-B — review P2)
**Verified:** `?page=N` is unbounded → 200; mid-range `noindex`, but **extreme page numbers flip back to `index,follow`**, and all leak the `usebaci.com` canonical. Google faceted-nav doc (2025-12-18): *"Return an HTTP 404 when a filter combination doesn't return results."*
**Why PR-B (not PR-C):** out-of-range `?page=N` must be a **hard 404** (a 200+canonical still burns a crawl). Page-level `notFound()` for category metadata exists (`[category]/page.tsx:84`) but is soft under streaming, so this needs the same **pre-stream proxy check** as §3 — keyed off a **cached per-category page-count signal**. That count signal needs the **same cache contract as the slug-sets (§3.3):** a dedicated tag (e.g. `category-page-count-${merchantId}`), `revalidateTag(..., 'categories')` on product/category mutations (page count changes when products are added/removed), **fail-open** (don't 404 when the count is unavailable), and tests. Don't 404 valid in-range pages. Also fix the `usebaci.com` pagination canonical (shares §3.5 root cause) in `seo-utils.ts` (`getIndexableRobotsMetadata` + `getCanonicalStorefrontFilterSearchParams` ~1660-1770).

### 3.7 PR-B scope, tests, risk

- **Files:** `proxy.ts` (HTML-gated existence-check + legacy-redirect 308 + pagination-range branch + `buildHardStatusStorefrontResponse` helper for 404/410), new `lib/cached-storefront-product-slug-set.ts` + category-slug-set + per-category page-count + a cached per-product **variant-axes** signal (§3.8), `cache-revalidation.ts` (new tags on mutation paths), `[category]/page.tsx` (doorway stopgap), the `buildStoreUrl` call-site audit (§3.5, canonical fix). Colocated tests for each + `proxy.test.ts` (status + `no-store` + CSP + storefront `Vary` assertions + the regression matrix below).
- **Risk:** `proxy.ts` is protected (auth/CSRF/rate-limit/custom-domains) — **explicit approval required**; the existence-check branch must not short-circuit the rest of the proxy flow (review P1); **false-positive 410 is destructive** (de-indexes a live product) — default to 404, 410 only on an explicit `archived`/`deleted` flag; the slug-set must be tag-invalidated on every mutation (§3.3) and fail open.
- **Verification — preview deploy. Test matrix (review P2, expanded):**
  - Status: real product (200); missing product (404); **archived variant WITH active parent → 308** (legacy_redirect — distinct from both the category-mismatch 308 and the no-replacement 410; must not regress the existing `permanentRedirect`); **archived/deleted with NO active replacement → 410**; invalid merchant (404); legacy slug + **category-mismatch slug (308 — must not regress)**; doorway category slug (404/noindex).
  - **Hard-status headers:** 404 and 410 each assert `Content-Security-Policy` is set, `X-Frame-Options`/`X-Content-Type-Options` set, storefront `Vary` appended, `Content-Type === 'text/html; charset=utf-8'` (NOT the default `text/plain`, else `nosniff` blocks rendering), and `Cache-Control === 'no-store'` (NOT `s-maxage`) — i.e. no cache-section branch overwrites `no-store` for product-shaped hard statuses.
  - **Legacy-redirect `Location`:** the 308 asserts an **absolute** `Location` with the correct origin AND merchant path prefix per URL shape — custom-domain `https://ogabassey.com/<new-path>`, subdomain `https://ogabassey.usebaci.com/<new-path>`, and root-domain path mode **`https://usebaci.com/ogabassey/<new-path>`** (the `/ogabassey` prefix MUST be preserved — `buildProductRedirectPath` returns an origin-root path with no prefix, so a naive `new URL(path, request.url)` would drop it in path mode). A relative target would throw at `NextResponse.redirect`.
  - **Must NOT be 404'd** (regression guards): the OG/`opengraph-image`/metadata routes for products; `RSC` / `Next-Router-Prefetch` requests (soft-nav prefetches) and `?_rsc=` requests; non-GET methods.
  - **URL shapes:** custom-domain (`ogabassey.com/...`), subdomain (`ogabassey.usebaci.com/...`), and root-domain path mode (`usebaci.com/ogabassey/...`) — the slug match + merchant resolution must behave identically across all three.
  - Then Search Console: soft-404 count drops; crawl stats shift toward canonical product/category URLs.

### 3.8 Deferred from PR #2479 — must land in PR-B (Codex review)
Two #2479 review findings are intentionally deferred here because their correct fix needs PR-B's proxy + slug-set (they cannot be fixed in #2479 without forcing the PDP dynamic or distinguishing a miss from a real product):

- **Invalid-variant 308 (Codex P2).** Today, an invalid variant URL (`?storage=128GB`, unknown `?variantId=`) only validates inside the Suspense children, so the shell can flush first and the redirect becomes a streamed/`meta` redirect, not an HTTP 308. Doing the check at the top of the page would require reading `searchParams` there, which forces the whole route dynamic and kills the static-shell LCP win. **PR-B fix:** validate variant params in `proxy.ts` (it sees the query string without touching the render) and **308-redirect to the canonical before the shell streams**, while ignoring tracking-only params (`utm_*`, `fbclid`, the metadata-cache-bucket param, etc.). (In #2479 this is mitigated: param URLs are `no-store` and canonicalize to the clean URL.)
  - **Slug-set membership is INSUFFICIENT here (review P2).** Variant validity depends on the product's actual axes + valid values — `getDeclaredVariantAxes` reads `attributeAxes`/`variant_attributes`/`variants[].attributes` (`product-selection-params.ts`), and `resolveVariantSelectionParamResolution` matches against real variant rows (`page.tsx:347-379`) — NOT on whether the slug exists. So the proxy needs its OWN **cached per-product variant-axes signal**, separate from the existence slug-set: add `getCachedProductVariantAxes(merchantId, slug)` (or extend `getCachedProductLcpHint` to carry `{ axes: string[]; valuesByAxis: Record<string,string[]>; variantIds: string[]; hasVariants: boolean }`). Cache contract identical to the slug-set (§3.3): a **dedicated tag** (`product-variant-axes-${merchantId}-${slug}`), `revalidateTag(..., 'products')` on every product/variant create/update/delete (axes change when variants are added/removed), and **fail-open** — when the signal is unavailable/empty/errored, do NOT 308; fall through to the existing in-render validation. Never 308 a valid variant deep-link. Colocated tests: valid axis/value (no 308), unknown axis/value (308), unknown `?variantId=` (308), tracking-only params ignored (no 308), signal-unavailable (no 308).

- **Slug-set GATES the edge cache, not just the 404 (Codex P3).** #2479 caches PDP-shaped URLs by **path**, so an unresolved miss (`/smartphones/not-yet-created`) can have its soft-404/`noindex` shell edge-cached and keep serving after the product is created. **PR-B fix:** the cacheable decision must be **confirmed-resolves**, not path-shaped — only apply the cache policy when the slug is in the product/category slug-set (§3.3); **unknown/miss PDP-shaped URLs stay `no-store`** (and become a hard 404 via §3.2). This is what makes the path-based caching introduced in #2479 fully correct.

> Pagination hard-404 was moved to **PR-B §3.6** (it needs the pre-stream proxy check + a cached page-count signal, so it is not a no-proxy change). The system-wide `usebaci.com` canonical fix lives in **PR-B §3.5**. PR-C is now sitemap-only.

## 4. PR-C — Sitemap hygiene

### 4.1 Sitemap parent-only filter
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

### 5.2 Root causes (same family as PDP) — corrected per review P2
- Render-blocking storefront CSS (~790ms) — **shared with PDPs**.
- **The whole post content is wrapped in `<Suspense>`** (`blog/[postSlug]/page.tsx:137`), and inside that subtree `blog-post-page-content.tsx` calls `draftMode()` (`:52`) and `notFound()` (`:68`) and renders the hero `<Image priority>` (`:191-195`). So the hero is in the streamed/dynamic subtree, AND `draftMode()` makes the content request-time dynamic.
- Post hero hint not emitted — `lcp-discovery-insight` scored 0, `priorityHinted:false`. In Next 16 the LCP hint comes from `<Image preload>` (or `fetchPriority="high"`), not the older `priority` prop alone (Next Image docs). Note: the Next 16 Image docs list `fetchPriority` under *when NOT to use `preload`* — they are alternative hints, so use exactly **one** of them on the hero (see fix #2).

### 5.3 Fixes — ordered by dependency (review P2: prerender is NOT a standalone win)
1. **[PREREQUISITE — HIGH, M]** Move the hero `<Image>` + its preload **above the `<Suspense>` boundary** (out of `blog-post-page-content.tsx`'s streamed subtree), and isolate `draftMode()`/below-fold in their own Suspense holes — exactly the #2479 PDP pattern. Until this lands, prerendering does NOT put the hero in the static shell.
2. **[HIGH, S]** Switch the hero from `priority` to `<Image preload>` (Next 16) so the discovery hint actually emits. Set **`preload` on the hero `<Image>` only — do NOT also set `fetchPriority` on it** (Next docs treat them as alternatives); if a high-priority hint is wanted, put `fetchPriority="high"` only on the separate `<link rel="preload">` head hint, mirroring the PDP `critical-shell.tsx` (preload on the Image, `fetchPriority` on the link hint).
3. **[HIGH-both, M]** Split/inline the blog/storefront critical CSS so the blog route doesn't pull the full PDP stylesheet — shared win with PDP.
4. **[MED, M]** `generateStaticParams` for the 392 posts — **only delivers the LCP/TTFB win AFTER #1 (hero hoisted) and once the content is not gated by `draftMode()` on the public path**; otherwise it prerenders an empty shell and the hero still streams. Sequence #1→#4. (Prerendering does NOT fix missing posts — those need the §3 proxy hard-404.)
5. **[MED-index, S]** Tighten the index hero `sizes` from `100vw`.
6. **[LOW-SEO, S]** `NewsArticle` JSON-LD for time-sensitive posts (`news-sitemap.xml` already exists); keep `BlogPosting` for evergreen.

---

## PR-E — Bot metadata delivery (S1, CRITICAL — carried from the teardown plan)

Folded in here so PR-B/C/D and the metadata fix live on one tracking surface. This is **not** an LCP item and is **not** measured by PSI — it's measured by Search Console impressions/CTR + the Rich Results Test. It is the highest-impact SEO item left.

### E.1 Problem (verified live 2026-06-14, post-#2479, Googlebot UA, no JS)
The PDP HTML still ships **two `<title>` tags**:
1. `<title>Ogabassey</title>` — the generic PPR **static-shell** title, emitted **first** in `<head>`.
2. `<title>Samsung Galaxy Z TriFold Price in Nigeria | … | My New Business</title>` — the resolved product title, emitted **second** (from the streamed `__next_metadata_boundary__`).

Per the HTML spec / crawler behaviour, **the first `<title>` wins**, so naive crawlers and AI bots (which don't reconcile the streamed second title) index the generic **"Ogabassey"**. `robots` and `canonical` ARE correct now (self-canonical, `index,follow`) — the defect is title (and, by the same mechanism, any head metadata that the shell emits a placeholder for). **Bonus defect found:** the *resolved* title is also malformed — `… | Ogaba… | My New Business` — a **mid-word truncation of the brand + a default "My New Business" store-name suffix** leaking through the title/`og:title`/`twitter:title` template.

### E.2 Root cause
Next 16 PPR: `generateMetadata` resolves into the streamed metadata boundary that flushes **after** the static shell, and the static shell carries a generic placeholder `<title>`. The metadata-blocking cache bucket (`config/storefront-metadata-cache-bots.ts` + the proxy `__baci_metadata_cache_bucket` param) is meant to serve bots a fully-resolved variant, but the teardown verified it served the **wrong cached variant** in prod (Googlebot got the less-resolved doc; CDN cache key ignores the query string on PDP routes, so cache-busted bot requests still `HIT`). Plus a metadata-template suffix/truncation bug (the "My New Business" fallback + brand truncation).

### E.3 Fix (ordered)
1. **Repro first — but split by layer (review P2):** the title/head defect (E.1 #1–2) is an **origin-rendering** issue, while the wrong-variant-for-bots defect (E.2) is **Vercel/CDN cache partitioning** — and local `next start` **cannot** reproduce edge cache-replay (see §1). So repro on two surfaces: **(a) local origin render** — raw bot-UA fetch of the locally-built prod render asserts exactly **one** `<title>` in `<head>` and that it is the **product** title (not the shell placeholder), for PDP + category + home; **(b) preview/live edge** — bot vs browser requests on a preview deployment assert `x-vercel-cache` MISS→HIT behaviour and that the bot bucket serves the resolved variant (the partitioning bug only manifests at the CDN).
2. **Static shell carries the resolved head:** ensure the prerendered shell emits the route-specific `<title>`/`canonical`/`robots`/`description` in the FIRST head (metadata in the static partition, not a deferred placeholder), keyed per param via the existing `generateStaticParams` + cache-safe `generateMetadata`. Make the shell/resume tree invariant across streaming vs blocking metadata (the `#92087` family — do NOT reintroduce a broad `connection()`).
3. **Cache partitioning (needs `proxy.ts` approval) — specify the mechanism, don't re-ship the failed one (review P2):** the infra already exists — `STOREFRONT_METADATA_CACHE_BUCKET_HEADER` (`x-baci-metadata-cache-bucket`) + `STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM` (`__baci_metadata_cache_bucket`), a rewrite that injects the query-param partition (`proxy.ts` ~2237, `setStorefrontMetadataCacheBucketSearchParam`), and a `Vary` on HTML routes (`next.config.ts:544`). It still failed in prod, so "fix the variant selection" is insufficient by itself. Vercel's CDN partitions on `Vary` **only if the FINAL cacheable response actually carries it** — and the code comment at `proxy.ts:2237` already warns "a Vary header that Next/Vercel may replace." So the fix MUST pick a cache-key mechanism and prove it survives to the edge:
   - **Preferred — query-param cache key:** make the bot vs browser distinction a real part of the URL/cache key via `__baci_metadata_cache_bucket` (already injected on rewrite), so the CDN keys on it directly and does not depend on `Vary` surviving. Ensure the bucketed URL is the one actually cached (the rewrite target), and that the param is internal-only (already a §6 verified non-issue: 0 occurrences in canonicals/sitemaps).
   - **If keeping `Vary`:** the plan must require a captured-response assertion that the final prerendered PDP HTML response carries `Vary: x-baci-metadata-cache-bucket` end-to-end (origin → CDN), since Next/Vercel can drop/replace it; if it doesn't survive, do not rely on it.
   Determine empirically which one the CDN honours before building on it (spike, like §3.3's slug-set spike).
4. **Title template bug:** fix the metadata builder so the title is `"<Product> Price in Nigeria | <Store>"` with the real store name (not "My New Business") and no mid-word truncation; same for `og:title`/`twitter:title`.
5. **Purge stale CDN cache + re-verify live** with raw bot-UA fetches (single product `<title>`, well-formed `og:title`).

### E.4 Verification (two gates — review P2)
- **Gate 1 — local origin rendering** (no CDN): colocated tests / raw bot-UA fetch of the local prod build assert exactly **one** `<title>` in `<head>` = the product/page title, and well-formed `og:title`/`twitter:title`, for PDP + category + home. This proves the render is correct independent of caching.
- **Gate 2 — preview/live CDN partitioning** (cannot be done locally — §1): on a preview deployment,
  - **Both-order cross-contamination tests (review P2 — required):** run (a) browser request → `HIT`, THEN Googlebot → `HIT`; and (b) Googlebot → `HIT`, THEN browser → `HIT`. In BOTH orders assert the first `<title>` and the resolved metadata never cross buckets (browser never serves the bot-bucket doc and vice-versa) — i.e. priming one bucket must not poison the other.
  - **Mechanism survival:** assert `x-vercel-cache` MISS→HIT per bucket; and EITHER the cached URL carries the `__baci_metadata_cache_bucket` cache-key segment (preferred mechanism), OR the final HTML response carries `Vary: x-baci-metadata-cache-bucket` end-to-end (if relying on Vary — capture the actual edge response headers, since Next/Vercel may strip it).
  Then Search Console (impressions/CTR by query) + Rich Results Test over the following weeks — NOT PSI.

### E.5 Risk / sequencing
Touches `proxy.ts` (cache bucket) — **explicit approval required** (same gate as PR-B §3.3). Independent of the crawl-budget hard-status work; can run in parallel with PR-B's no-proxy parts. Files: `config/storefront-metadata-cache-bots.ts`, `[slug]/layout.tsx` (shell head), the metadata/title builder (`seo-utils.ts` title template), `proxy.ts` (bucket selection — observe/approve).

## PR-F — PDP metadata/SEO value correctness — merchant + currency leakage ✅ RESOLVED 2026-06-14 (data fix)

The server-rendered SEO/metadata layer was emitting wrong currency (DZD) and wrong store name ("My New Business") across JSON-LD, meta tags, OG/Twitter, the hidden semantic summary, and breadcrumb — Google would have indexed OgaBassey priced in **Algerian Dinar** with seller **"My New Business"**. **Turned out to be a DATA bug, not the hypothesized code divergence.**

### F.1 Root cause (confirmed — 5-agent trace + Supabase + live)
NOT a two-data-path / fallback-merchant code bug. Both `generateMetadata` and the render read the **same** resolved merchant via `getRequestScopedMerchant` (the LCP hint carries no merchant fields). The OgaBassey **merchant row itself** (`id 6b5cb8a4-…`, domain `ogabassey.com` correctly mapped) still held its **un-onboarded Algerian signup defaults**: `business_name='My New Business'`, `payout_currency='DZD'`, `country='DZ'` (created 2025-11-14, never completed). The code faithfully rendered those values everywhere that reads `merchant.payout_currency` / `merchant.business_name` — so the leak was **site-wide** (home, search, category, listings, compare, PDP, emails, llms feed, wallet), not PDP-only. The visible ₦ price only *looked* right because the OgaBassey template hardcodes `'NGN'` in `toOgabasseyProduct` (page.tsx:90/291) — a coincidental mask, not a correct resolution. The "double suffix" title was a symptom: `product.meta_title` ends `| Ogabassey` and `generateMetaTitle` appended `merchant.business_name` (`My New Business`); they differed, so the dedupe didn't fire.

### F.2 Resolution (applied + verified)
**Data fix** (owner-approved; `payout_currency`/`country` are financial/operational config): `UPDATE merchants SET business_name='Ogabassey', payout_currency='NGN', country='NG' WHERE id='6b5cb8a4-…'`. Verified live (Googlebot UA) on `/laptops/macbook-air-m1-2020` and `/smartphones/samsung-galaxy-z-trifold`: `priceCurrency`/`product:price:currency` DZD→**NGN**, JSON-LD seller "My New Business"→**Ogabassey**, title `…| Ogabassey | My New Business`→**`…| Ogabassey`** (double-suffix self-resolved once the names matched), `DZD`/`DZ` count 34→**0**, visible `₦690,000` unchanged. Merchant `'use cache: remote'` (`cacheLife('merchant')` = stale 300/revalidate 60/expire 3600) self-healed on the next request — no redeploy needed. **Systemic check: 0 of 15 published merchants** still carry these defaults — OgaBassey was the only one affected.

### F.3 Follow-ups
1. **Prevent recurrence (optional, low urgency):** a published storefront should not serve SEO with un-onboarded defaults. Consider onboarding/publish validation (require real `business_name`/`payout_currency`/`country` before `is_published`). No other merchant affected, so not scheduled.
2. **Visible⇄SEO currency consistency** → now tracked as **PR-G.1** (owner asked to add it).
3. **OG-image merchant resolution** → now tracked as **PR-G.2** (owner asked to add it).
4. **`open_box` mapping — ✅ DECIDED (by design):** `open_box → schema.org/RefurbishedCondition` is **intentional** — customers see "Open Box" in the UI copy, while Google's vocabulary only has `RefurbishedCondition` as the closest match, so that is what we emit in structured data. The shared tests asserting this mapping (`product-condition.ts`) are correct — **do NOT change.**

## PR-G — Metadata correctness code hardening (follow-up to PR-F's data fix)

PR-F's data fix resolved the live leak; these two code changes harden the same surface so a future misconfiguration can't silently mislead, and fix a latent resolution bug. Both are no-proxy, no approval gate, low risk.

### G.1 Visible⇄SEO currency consistency
**Problem:** the OgaBassey template formats the visible price via `toOgabasseyProduct(product)` called with NO currency arg, so it hardcodes `'NGN'` (page.tsx:90, 291). That **masks** any mismatch between the visible price and the merchant-derived SEO/JSON-LD currency (`merchant.payout_currency`) — exactly why the DZD bug was invisible on-screen while polluting structured data. **Fix:** thread `merchant.payout_currency` (with an explicit `'NGN'` fallback) into `toOgabasseyProduct` so the visible price and the SEO/JSON-LD currency derive from one source — a divergence then shows on-screen instead of hiding in metadata. **Call-chain change (review P3):** `toOgabasseyProduct(product)` is invoked inside `renderTemplateProductPage` (`page.tsx:291`), which today only destructures `{ product, renderMode, templateId, semanticSections }` (`page.tsx:278-284`) — so the currency has to be threaded through it: add a `payoutCurrency` field to `renderTemplateProductPage`'s params, pass it at the call site (`page.tsx:1269`, where `merchant.payout_currency` is in scope), and forward it into `toOgabasseyProduct(product, payoutCurrency)`. **Caveat:** this is entangled with the documented `en-NG`/₦/7.5%-VAT hardcoding tech debt ([[project_market_rollout]]) — keep the change surgical (currency source only; do not broaden locale/VAT handling here). **Test:** PDP render with `payout_currency='NGN'` → visible price formats NGN and equals the JSON-LD `priceCurrency`; with a non-NGN merchant → both agree (no silent NGN mask).

### G.2 OG-image: merchant resolution **+ drop the service-role client (review P1 — repo-rule violation)**
**Two problems in BOTH OG-image routes** (`[category]/[productSlug]/opengraph-image.tsx` and `products/[productSlug]/opengraph-image.tsx`):
1. **Wrong resolver:** they query `merchants` via `.eq('slug', slug)`, but for a custom domain the `[slug]` route param is the **domain** (`ogabassey.com` ≠ slug `ogabassey`) → no match → "Product Not Found" fallback image. (Currently **dead code** — the PDP sets `openGraph.images` to the product CDN image, so Next doesn't use this route for `og:image` — no live impact today, but a correctness landmine if `openGraph.images` is ever dropped.)
2. **Repo-rule violation (P1):** both routes use `createAdminClient()` (service role, line 23) to read **public** `merchants`/`products` data — a user-facing read. `.ruler/01-critical-rules.md:5` / CLAUDE.md: **"NEVER use the admin/service-role Supabase client for user-facing operations."** This must be fixed regardless of the dead-code status.

**Fix:** replace the route-level `createAdminClient()` with a **service-role-free** public read. ⚠️ Note (review P1): the obvious "use `getMerchantByIdentifier` / `getCachedMerchant` / `getCachedMerchantByDomain`" do NOT satisfy the rule — they call `getServiceRoleSupabaseClient()` internally (`cached-data.ts:550, 687`), so service role still flows. Use the **anon, RLS-respecting `createPublicClient()`** (`@/lib/supabase/public`, anon key — the same client `getCachedStorefrontProductIndex` uses) for the merchant + product reads (both are public-read under RLS), resolving the merchant by **domain-or-slug** (so the custom-domain param `ogabassey.com` resolves, fixing the "Product Not Found" bug). If a cached merchant-by-domain helper is wanted, add a NEW `createPublicClient`-backed one — do not reuse the service-role variants. **Tests:** custom-domain param resolves the merchant (not "Product Not Found"); slug param still resolves; and assert the route imports **neither** `@/lib/supabase/admin` **nor** any service-role-backed helper (`getServiceRoleSupabaseClient`, `getCachedMerchant*`) — i.e. it reads via the anon `createPublicClient`.

### G.3 Scope / priority
- **Files:** `[category]/[productSlug]/page.tsx` (`toOgabasseyProduct` currency arg), `[category]/[productSlug]/opengraph-image.tsx` (+ `products/[productSlug]/opengraph-image.tsx`), colocated tests.
- **Priority:** MEDIUM hardening — no live regression today (PR-F's data fix already corrected the visible leak), so sequence after PR-B/PR-E. No proxy approval needed.

## PR-H — PDP LCP image preload↔render alignment (perf follow-up to #2479)

The "remaining LCP lever" after #2479: the earliest PDP LCP preload fetches a **different same-origin image profile** than the rendered critical `<img>` consumes, so the preload is wasted and the browser issues a second fetch. Eliminating that duplicate is worth the ~65ms alienware needs to cross the 2.5s DebugBear gate. Source plan (TDD scaffolding to reuse): `docs/superpowers/plans/2026-06-14-ogabassey-pdp-lcp-image-preload-alignment.md` — **adopt its structure but with the corrected fix direction below.**

### H.1 Root cause (verified against code)
`/api/ogabassey/pdp-lcp-image/profile/[profile]/[slug]` serves a **fixed size per profile** (ignores `?w`/`?q`): `desktop`=640/q35, `mobile`=750/q30, **`mobile-header`=1080/q35**. `product-media.ts` states the intended mobile hero candidate is **1080w** (DPR ≈ 2.6 × ~412 CSS px). Observed: the early preload (HTTP `Link` header / React `preload()`) requested `mobile-header` (1080, ~13.8KB) while the rendered `<img>` srcset used `profile/desktop` (640, ~7.2KB) → **two fetches, preload not consumed**, and if 640 is what actually renders on mobile, a **half-resolution hero**. (Live state was inconsistent across deploys — `mobile` vs `mobile-header`, a `<picture>` source that may/may not exist — so verification is step 1.)

### H.2 Corrected fix — align preload↔render PER BREAKPOINT (do NOT flatten to 640)
The source plan converges everything onto `profile/desktop` (fixed **640**). **Rejected:** that downgrades high-DPR mobile from the intended 1080 → a softer product hero (contradicts the plan's own "no blind quality reduction" non-goal), and builds a degenerate srcset (every width descriptor → the same fixed-size URL). Instead:
- **Mobile:** preload **and** render both use `profile/mobile-header` (1080) → preload consumed, mobile stays crisp.
- **Desktop:** preload **and** render both use `profile/desktop` (640).
- The three emitters — HTTP `Link` header (`next.config.ts`), React `preload()` (`ogabassey-pdp-product-resource-hints.ts`), and the critical-shell `<img>`/`<source>` (`critical-shell.tsx`) — must agree on the **same per-breakpoint profile URL**, via a single source-of-truth builder in `product-image-source.ts`.
- Since the profile route is fixed-size, emit **one correct URL per breakpoint** — do NOT fabricate a width-descriptor srcset of identical URLs. (If a single profile is ever desired for cache simplicity, choose **1080**, never 640.)
- **Replace the single `next/image` `<Image preload>` with art direction (review P2).** The critical shell currently renders one `<Image … preload src={productImageSrc}>` (`critical-shell.tsx` ~159) hardcoded to `profile/desktop` — `next/image`'s `preload` prop inserts ONE unscoped `<head>` preload, which Next's own Image docs say **not** to use when there are multiple viewport-dependent LCP images. With per-breakpoint art direction, switch to `getImageProps()` + `<picture>`/`<source media>` (mobile source = `mobile-header`/1080, default `<img>` = `desktop`/640) so each breakpoint preloads its own URL via the media-scoped HTTP `Link` header — and **drop the `preload` prop** so no leftover unscoped desktop preload is emitted.

### H.3 Pre-req gate + validation
1. **Verify current state first** (fresh `origin/main` worktree): capture live preload profile(s) vs rendered `<img>` profile(s) on a prerendered PDP, and **what width mobile actually renders today** (640 vs 1080). **Visual QA the hero at 390×844 @ DPR 2–3 before/after** — the fix hinges on not softening it. If preload already matches render at the intended resolution, stop and remeasure.
2. **TDD** (per source plan): failing tests in `next.config.test.ts`, `critical-shell.test.tsx`, `ogabassey-pdp-product-resource-hints.test.ts` asserting mobile preload+render+Link all = `profile/mobile-header` and desktop all = `profile/desktop`; no leftover cross-profile fetch; **and (review P2) assert NO unscoped `<Image preload>`/single head `<link rel=preload as=image>` survives the breakpoint split** — preloads must be media-scoped per breakpoint, not one unscoped desktop preload.
3. **Collapse redundant preloads:** don't emit two `Link`/preload entries with different `media` pointing at the *same* URL — one per distinct URL.
4. **Acceptance:** DebugBear **mobile** LCP ≤ 2500ms AND no duplicate cross-profile image fetch before LCP AND the mobile hero renders the 1080 candidate (crisp). Note: alienware's `loadDuration` ≈ 1.3s dominates LCP — the larger lever is **fewer cache keys → higher edge-HIT rate** + the image route's transform speed; if LCP stays >2500ms after dedupe, that's the next target (don't broaden this PR).
5. **DebugBear API:** the verified path is `POST /page/{id}/analyze` + `GET /analysis/{id}` (`x-api-key`); confirm the source plan's `quickTests` endpoint works before relying on it ([[reference_debugbear_api]]).

### H.4 Scope / priority
- **Files:** `next.config.ts`, `product-image-source.ts`, `critical-shell.tsx`, `ogabassey-pdp-product-resource-hints.ts` + colocated tests. **Do NOT touch `proxy.ts`**; keep the #2479 PPR/static-shell architecture.
- **Priority:** MEDIUM perf — no proxy gate, can run alongside PR-E. Distinct from PR-G (correctness) — this is LCP image *delivery*.

## 6. Verified NON-issues (do NOT spend effort here)
- Facet/tracking/`?variantId=`/`?__baci_metadata_cache_bucket=` params **self-canonicalize** to the clean URL (`getValidatedProductUrl` discards canonicals carrying `search`/`hash`).
- The `__baci_metadata_cache_bucket` param does **not** create crawlable duplicates (internal-rewrite only; 0 occurrences in `products.xml`/canonicals).
- **No redirect chains** — every case is exactly 1 hop (www→apex, http→https, trailing-slash 308, case 308).
- **Sitemap hygiene clean** — all sampled URLs 200/self-canonical/`index,follow`; real `lastmod`; empty result → 503+`no-store` (not empty-200). Counts: products 1,237 · categories 27 · blog 392 · news 18 · static 4 · commercial-support 19.
- **`/product/<slug>`** is a 308 redirect; **`/products/<slug>`** is a live fallback for uncategorized products — **do NOT robots-Disallow either** (would break the 308s / uncategorized PDPs).

---

## 7. Sequencing & dependencies
1. **PR #2479** (LCP + review fixes) — ✅ **MERGED 2026-06-14** (`eaca402662`); canary clean, LCP verified ~1.06s (Chrome) / 2.5s (DebugBear) across PDPs, CLS 0. Remaining checkpoint: field CrUX p75 by ~mid-July.
2. **PR-B** (crawl-budget core): the **no-proxy** parts (doorway `noindex` stopgap, `custom_domain`/`usebaci` canonical fix) can land first; the **proxy** parts (hard-404/410 + slug-sets + pagination-range, all behind the §3.3/§3.6 invalidation contracts) follow once the proxy edit is approved. Highest crawl-budget leverage.
3. **PR-C** (sitemap-only): the product-sitemap parent-only filter. Small, independent.
4. **PR-D** (blog): quick win (post hero `<Image preload>`) → hero-hoist-out-of-Suspense prerequisite → `generateStaticParams` mirror of #2479.
5. **PR-E** (bot metadata / S1): independent of the crawl-budget hard-status work; the no-proxy parts (static-shell head, title template) can land first, the cache-bucket fix follows proxy approval. Highest-impact SEO *delivery* item. Measured by Search Console, not PSI.
6. **PR-F** (metadata value correctness — DZD/"My New Business" leak): ✅ **RESOLVED 2026-06-14** via a one-row data fix (the OgaBassey merchant carried un-onboarded Algerian defaults). Live-verified site-wide.
7. **PR-G** (metadata correctness code hardening): the visible⇄SEO currency consistency + OG-image merchant resolution. MEDIUM, no proxy gate; sequence after PR-B/PR-E (no live regression today).
8. **PR-H** (PDP LCP image preload↔render alignment): kill the duplicate cross-profile LCP image fetch by aligning preload+render per breakpoint (mobile=1080 `mobile-header`, desktop=640). MEDIUM perf, no proxy gate; can run alongside PR-E. Gated on verifying current render size + hero visual QA.

Shared root causes across PRs: the **`usebaci.com` canonical** root cause (PR-B, used in 58 files incl. blog); the **render-blocking CSS** (PR-D + PDP); the **pre-stream proxy check** (PR-B doorway + soft-404 + pagination-404), all sharing the cached-set + invalidation contract.

---

## 8. Open decisions for the owner
1. **Approve the `proxy.ts` edit** for the hard-404/410 existence check (PR-B core; proxy runs Node — §3.2)? Without it, the doorway trap and soft-404s can only be downgraded to `noindex`-200, not hard 404 — still a big win, but not the crawl-budget optimum.
2. **404 / 410 / 308 policy** — confirm the slug-state machine: **308** when an archived slug has an **active replacement parent** (legacy_redirect — must not regress the existing `permanentRedirect`); **404** default for unknown/missing/typo; **410** ONLY for `archived`/`deleted` with **no active replacement**. Fail-open on any uncertainty.
3. **Prerender scope** — keep OgaBassey-hardcoded `generateStaticParams` (consistent with 18 existing files), or build the `PRERENDER_PRIORITY_MERCHANTS` config now (Jules's suggestion)?
4. **Blog prerender count** — all 392 posts, or a recent-N subset?
5. **PR-E (S1 bot metadata) priority** — slot it into this wave (highest SEO impact; needs the same `proxy.ts` approval as PR-B for the cache-bucket fix), or sequence after PR-B/C/D? Its no-proxy parts (static-shell head, title template) can start independently.
6. **PR-F `open_box` condition mapping** — ✅ **DECIDED (by design):** intentional — customers see "Open Box" in the UI, Google gets `schema.org/RefurbishedCondition` (its closest concept). Shared tests are correct; no change.

### Hard gates before PR-B ships hard statuses (review P1)
- **Slug-set invalidation contract (§3.3) + mutation-path tests** must exist and pass — a stale set 404/410s a live product. This is non-negotiable; default fail-open + 404-not-410.
- **Spike: confirm how the Node proxy reads the cached slug-set** (direct `'use cache'` call vs internal-route `fetch`) before building on it.
- **Matcher GET/HEAD HTML gating + the expanded test matrix (§3.2, §3.6)** green, including RSC/prefetch and category-mismatch-308 regression guards.

---

## Appendix — evidence index
- **Live crawl probes (Googlebot UA):** `/totally-made-up-slug-9z9z9` → 200 `index,follow` self-canonical (doorway trap); `/smartphones/bogus-product` → 200 `noindex` canonical=`usebaci.com`; `/smartphones?page=900` → 200 `noindex` canonical=`usebaci.com`.
- **Next 16 docs (v16.2.9):** `loading.js` Status Codes (2026-03-13); `proxy.js` (2026-05-13); `cacheComponents` / `generateStaticParams` (cacheComponents requires ≥1 param; `dynamicParams` disallowed with cacheComponents).
- **Google Search Central (2025/2026):** Crawl Budget (2025-12-19); Faceted navigation (2025-12-18); Sitemaps (2025-12-10); HTTP status meanings (2026-02-04).
- **Code refs:** `proxy.ts` (matcher, `RESERVED_STOREFRONT_SEGMENTS`, cache section); `lib/cached-data.ts` (`getCachedCategoryPageData` ~1652-1891, legacy fuzzy fallback ~1850); `lib/store-url.ts` (`buildStoreUrl` ~55-74); `lib/cached-storefront-product-index.ts`; `[category]/page.tsx`; `seo-utils.ts` (`getIndexableRobotsMetadata`, `getCanonicalStorefrontFilterSearchParams`); `[slug]/sitemap-data.ts`; `blog-post-page-content.tsx:174`; `cache-revalidation.ts` (tag invalidation).
- **PR #2479 reviews:** Codex (P1 layout tests, P2 cache breadth = real leak, P2 variant redirect) — all addressed; Jules (HIGH false positive, MEDIUM optional, LOW = variant redirect).
