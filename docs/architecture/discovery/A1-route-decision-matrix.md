# A1 Per-Route Decision Matrix — Storefront Catalog Prerender

**Scope:** Read-only analysis of `origin/main` @ `c8108a052dfccfb0c99f4c5e6cac96a56dad9587`. For each of the 6 catalog routes: GO/NO-GO for a prerendered (`generateStaticParams`) PPR shell, the concrete replacement for the request-time behavior it would lose, and the `generateStaticParams` source.

## The load-bearing precedent this matrix is calibrated against

The categorized PDP `(catalog)/(pdp)/[category]/[productSlug]/page.tsx` is **already shell-resolvable** and defines the "clean" pattern:

- Its `generateStaticParams` (`product-static-params.ts`) walks `getCachedStorefrontProductIndex(OGABASSEY_MERCHANT_ID)` and returns `{ slug: OGABASSEY_DOMAIN, category, productSlug }[]`, with a single **placeholder param** (cacheComponents requires ≥1) and a **fail-open** partial-walk on index error.
- Its `generateMetadata` reads **`params` only — never `searchParams`, never `headers()`**. That purity is *why* the resolved `<title>`/canonical/robots can be baked into the static `<head>`.

The static-params file's own comment is the governing SEO fact for this whole matrix:

> *"only params enumerated here get a PPR shell with the resolved `<title>` baked into `<head>`; non-enumerated params render with streamed metadata forever (the PPR resume forces streaming regardless of `htmlLimitedBots`), which raw-HTML crawlers read as a missing/wrong title (Semrush 2026-07-10: bare-'Ogabassey' duplicate titles)."*

**Corollary that decides every row below:** a route can only bake a correct crawlable `<head>` if its `generateMetadata` for the indexable (canonical) URL is a pure function of **path params**. The moment `generateMetadata` `await`s `searchParams` or `headers()`, metadata goes dynamic/streamed and the shell win evaporates. A single route cannot inspect whether query parameters are present only for some requests without making that route's metadata request-time. "MAKE SHELL-RESOLVABLE" therefore requires either dropping the query-dependent metadata behavior explicitly or splitting it onto a different signed-off route surface.

---

## Verdict summary

| # | Route | Reads `searchParams` / `headers()` in `generateMetadata`? | Indexable canonical? | **Verdict** | `generateStaticParams` source |
|---|-------|--------------|--------------|------------|-------------------------------|
| 1 | `(listing)/[category]/compare/page.tsx` | `searchParams` (noindex gate) — **plus `notFound()`** ~:132, and body `headers()`+308 | yes (canonical hub) | **KEEP DYNAMIC** (NO-GO) | n/a |
| 2 | `(pdp)/products/[productSlug]/page.tsx` (flat PDP) | `searchParams` (variant safety-net) + DB legacy lookup | **no** — redirect surface, always noindex | **EXCLUDE FROM A1** (NO-GO, keep dynamic) | n/a |
| 3 | `(listing)/[category]/page.tsx` | `searchParams` (page + facets) | yes (page-1 canonical) | **KEEP DYNAMIC** (NO-GO under current query-param metadata contract) | n/a |
| 4 | `(listing)/products/page.tsx` | `searchParams` (page + facets) | yes (page-1 canonical) | **KEEP DYNAMIC** (NO-GO under current query-param metadata contract) | n/a |
| 5 | `(listing)/compare/page.tsx` (global hub) | `searchParams` (noindex gate only) | yes (fixed `/compare` canonical) | **MAKE SHELL-RESOLVABLE** (GO) | `[{ slug: OGABASSEY_DOMAIN }]` (single) |
| 6 | `(listing)/search/page.tsx` | `searchParams` (`q`) + `headers()` | **no** — always `noindex` | **KEEP DYNAMIC + noindex** (NO-GO, confirmed) | n/a |

Net: **1 GO (row 5) and 5 NO-GO (rows 1–4 and 6).** Concretely: only the global compare hub accepts an explicit query-variant metadata tradeoff and is approved to prerender; the other five routes stay dynamic.

---

## Route 1 — `(listing)/[category]/compare/page.tsx` (category compare hub)

**Verdict: KEEP DYNAMIC (NO-GO for prerender).**

**What it would lose.** Three request-time behaviors, all load-bearing:
1. **Real 404 before the 200 commits.** `generateMetadata` calls `notFound()` (~:132) when `data.compareLinks.length === 0 && !data.inventoryDegraded`. The in-file comment is explicit that throwing *in metadata* — not only the body — is the mechanism: the streamed body can commit a 200 shell before the body's `notFound()` runs, but blocking metadata (the bot path) resolves before headers flush, so crawlers get a real HTTP 404 on an empty (anti-thin-page) hub.
2. **`headers()`-based path prefix + non-canonical-slug 308.** The body reads `getStorefrontPathPrefix(headersList, merchant)` (which reads `x-forwarded-host` / `x-merchant-slug` / `x-custom-domain`) and `permanentRedirect`s a non-canonical category slug to `/${canonicalCategorySlug}/compare`.
3. **`searchParams` noindex** via `hasCompareHubSearchParams`.

**Why a static shell can't replace it.** A prerendered PPR shell **is always HTTP 200** — it structurally cannot emit the 404 that guards against thin/emptied hubs. And the inventory that decides emptiness (`getCachedProductSemanticInventory`) drifts after build: a hub that empties post-build would keep serving a stale 200 shell. The comment already warns that the proxy stamps cacheable CDN headers *without inspecting status*, so status correctness must come from the request-time render.

**The only static-compatible replacement (and why it's rejected):** an **edge existence check** — a build-time manifest of non-empty hub slugs consulted in middleware to 404 unknown/empty hubs before the shell commits. That is disqualified because (a) middleware is `proxy.ts`, a protected file that must not be modified without explicit approval, and (b) the manifest goes stale against live inventory, reintroducing exactly the thin-hub 404 gap. Not worth it for a low-traffic hub.

**Recommendation:** leave fully dynamic. The request-time `notFound()` is the cheapest correct 404. `generateStaticParams` source: none.

---

## Route 2 — `(pdp)/products/[productSlug]/page.tsx` (flat/legacy PDP)

**Verdict: EXCLUDE FROM A1 (keep dynamic).**

**What it is.** This is not an indexable destination — it is a **308-redirect shim** to the canonical categorized PDP (`(pdp)/[category]/[productSlug]`, which is *already* shell-resolvable). `resolveProductPage` performs, in order: legacy-slug 308 (`getCachedLegacyProductRedirectTarget` → `permanentRedirect`), categorized 308 (`getCategorizedRedirectTarget`), and a temporary variant-cleanup `redirect` (`getInvalidVariantSelectionRedirectTarget`, driven by `searchParams`).

**What it would lose.** All of the above are request-time and driven by (a) a DB legacy-slug map and (b) `searchParams` (variant params), neither enumerable by `generateStaticParams`. `generateMetadata` here only ever returns `LEGACY_PRODUCT_NOINDEX_METADATA` (`alternates: null, robots: { index:false, follow:true }`) as a **safety net for the 308 race** — because `generateMetadata` cannot change HTTP status (Next falls back to a `<meta refresh>` that Google reads as a soft redirect), so it emits noindex while the parallel page render issues the real 308.

**Why exclude.** There is **no crawlable shell to bake** — the page is noindex-or-redirect by design, and its canonical target already has a baked shell. Prerendering a redirect surface yields nothing, and the searchParams-driven variant redirect is inherently dynamic.

**Recommendation:** exclude from the A1 program entirely; keep dynamic. `generateStaticParams` source: none.

---

## Route 3 — `(listing)/[category]/page.tsx` (category listing)

**Verdict: KEEP DYNAMIC while query-param pagination/facets retain request-specific metadata (NO-GO for a baked shell).**

**Pagination question → answer: STAY query-param + self-canonical. Do NOT rel-canonical-to-root; do NOT switch to path-segment pagination.**

Today this page is dynamic (`connection()` + `Suspense`) and `generateMetadata` `await`s `searchParams` for: page pagination (`?page=N` via `parseStorefrontPageParam` / `buildStorefrontPageHref`), canonical filter params (`getCanonicalStorefrontFilterSearchParams`), and facet robots (`getIndexableRobotsMetadata(resolvedSearchParams)`). Because it awaits `searchParams`, **its metadata streams for every request** — i.e. page-1 (the indexable canonical) is exposed to the same bare-title risk the PDP was fixed for. That is the reason to act.

Note the canonical model is already correct and should be preserved: `buildStorefrontPageHref` makes each `?page=N` **self-canonical** (page N → page N, page 1 → clean URL). This is the modern Google model (rel=prev/next is deprecated); collapsing page 2 → root would de-index deep products. So the pagination answer is *stay query-param + self-referential canonical*, not rel-canonical-to-root, and not a `/category/page/2` path-segment rewrite (a large routing change that buys nothing since deep pages don't need baked shells).

**Decision:** preserve the current self-canonical `?page=N`, facet `noindex`, unknown-category soft-404, and degraded-inventory metadata by continuing to read `searchParams` at request time. [Current Next.js page docs](https://nextjs.org/docs/app/api-reference/file-conventions/page) define `searchParams` as request-time data that opts the page into dynamic rendering, and the [metadata contract](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) resolves `generateMetadata` as part of rendering; the same route cannot promise a baked base `<head>` while also branching its metadata on query parameters. Do not add `generateStaticParams` and describe the base case as prerendered under this contract.

Revisit shell-resolvability only with a separate, signed-off surface split that removes request-time metadata from the canonical category route (for example, path-based pagination/facet routes with their own metadata contract). Until then, preserving canonical/robots correctness wins over the shell optimization.

---

## Route 4 — `(listing)/products/page.tsx` (all-products listing)

**Verdict: KEEP DYNAMIC while query-param pagination/facets retain request-specific metadata (NO-GO for a baked shell).** Same pagination/facet answer as Route 3: **stay query-param + self-canonical.**

Structurally identical to Route 3 minus the dynamic category segment: `generateMetadata` awaits `searchParams` for `?page=N` (self-canonical via `buildStorefrontPageHref`) and facet robots (`getIndexableRobotsMetadata(resolvedSearchParams)`), so page-1 (`/products`, the indexable canonical) currently streams metadata.

**Decision:** preserve the current self-canonical `?page=N`, facet `noindex`, and out-of-range soft-404 metadata by continuing to read `searchParams` at request time. As with Route 3, do not add `generateStaticParams` while claiming the base `<head>` is baked under the same route contract. Revisit only through a separate surface split that removes query-dependent metadata from `/products`, or through an explicit SEO decision to drop that behavior.

---

## Route 5 — `(listing)/compare/page.tsx` (global compare hub)

**Verdict: MAKE SHELL-RESOLVABLE (GO — full base shell).**

This is the strongest GO of the group: **no pagination**, and the canonical is a **fixed** `${storeUrl}/compare`. `generateMetadata` only touches `searchParams` for the `hasCompareHubSearchParams` **noindex-on-query-variants** gate, plus an inventory-derived `hasCompareSections` gate. (It also delegates to the category-metadata path when an active "compare" category exists — that delegation stays intact behind the same fallback.)

**Canonical/robots rule without `searchParams`:** because the canonical is *always* `/compare`, any `?foo=bar` variant is a non-canonical URL that Google consolidates to the canonical on its own — the request-time `noindex` gate is belt-and-suspenders, not load-bearing. So the baked shell can safely be:

- `alternates.canonical = ${storeUrl}/compare`
- `robots = getIndexableRobotsMetadata()` (i.e. `index, follow`) — the fixed self-canonical handles query-param dedup; **drop the `searchParams` branch from the baked shell.**
- Title/description are pure functions of `merchant.business_name`.

The remaining request-time input is the anti-thin-page `hasCompareSections` gate (`noindex` when the hub is empty). For the enumerated OgaBassey shell this can bake `index,follow` on the assumption the hub is non-empty (OgaBassey's compare epic guarantees sections); if you want the empty-hub guard preserved, set `dynamicParams = true` so any *other* merchant / empty state renders on demand with the existing gate. The body is already `connection()` + `Suspense`, so it needs no change.

**`generateStaticParams` source:** `[{ slug: OGABASSEY_DOMAIN }]` (single).

---

## Route 6 — `(listing)/search/page.tsx`

**Verdict: KEEP DYNAMIC + `noindex` (NO-GO — confirmed).**

`generateMetadata` derives title (`Search results for ${q}`) and canonical (`${baseUrl}/search?q=${q}`) from the `q` **searchParam** and reads **`headers()`** (`buildRequestScopedStoreUrl`), and always returns `robots: { index: false, follow: true }`.

**Confirmation of the recommendation:** there is nothing to prerender. `q` is an unbounded, user-supplied space, so title/canonical cannot be enumerated by `generateStaticParams`; and the page is **always `noindex`**, so there is no crawlable `<head>` shell whose baking would benefit SEO. A prerendered shell would only serve a `q`-less `/search` skeleton that the client immediately overwrites. Leave fully dynamic and noindex, exactly as on `origin/main`.

**`generateStaticParams` source:** none.

---

## Cross-cutting implementation notes

- **Single-tenant prerender is the established convention.** The approved Route 5 implementation enumerates **OgaBassey only** via `OGABASSEY_DOMAIN` from `@/config/ogabassey`; other tenants keep rendering on demand via `dynamicParams = true`.
- **`dynamicParams = true` is mandatory** on Route 5 to preserve on-demand rendering and the existing empty-hub guard for non-enumerated params. Without it, non-OgaBassey stores 404.
- **cacheComponents ≥1-param rule:** Route 5 should mirror the established placeholder-param + fail-open-on-query-error shape if its empty-hub fallback needs build-time data, so a query failure degrades to a valid placeholder shell instead of failing the build.
- **Rows 3 and 4 have no current refactor opener.** A param-only helper does not make the route static if `generateMetadata` still reads `searchParams` for other requests. Their query metadata must move to a separate route contract or be explicitly retired before either verdict changes.
