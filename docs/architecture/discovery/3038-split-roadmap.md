I now have a complete, verified picture. Here is the roadmap.

---

# PR #3038 slicing roadmap — "fix(storefront): bound public read snapshots"

**Repo root:** `/Users/mac/Baci-app` · **Branch:** `codex/storefront-reliability-pr2` · **Worktree:** `/Users/mac/Baci-app/.worktrees/storefront-reliability-pr2`
All paths below are relative to the repo root and live under `apps/web/src/`.

## Ground truth established from the diff + the merged RPC

The snapshot RPC `resolve_storefront_public_snapshot_v2` (migration `supabase/migrations/20260710123000_storefront_public_read_snapshots.sql`, merged via #3043 on main) builds `merchant_data` from an **explicit allowlist**. For a **published** merchant it carries: `id, business_name, site_title, site_tagline, site_description, business_type, logo_url, phone, email, support_email, support_phone, social_media, brand_colors, slug, business_address, legal_entity_name, registered_address, tax_identification_number, trust_profile, payout_currency, is_published, template_id, country, hero_slides, mobile_hero_slides, favicon_svg_url, favicon_png_32_url, favicon_apple_touch_url, vat_registration_status, vat_rate, published_config, pages, about_page, faq_items, updated_at` **plus derived** `paystack_subaccount_configured` and `price_negotiation_enabled`. For an **unpublished** merchant it carries only `id, business_name, slug`. `feature_settings` and `custom_domain` are separate top-level snapshot columns.

**Correction to the task's premise:** favicons are NOT omitted — `favicon_svg_url`, `favicon_png_32_url`, `favicon_apple_touch_url` are all in the allowlist, so `toTemplateMerchantData`'s favicon mapping is safe. The genuinely **omitted** raw fields are `plan_tier`, `premium_features`, `paystack_subaccount_code`, `google_product_sheet_url`, `rider_phone_number` (and all bank/BVN/token fields). On main the previous `resolve_storefront_cached_merchant` RPC DID include raw `plan_tier`/`premium_features` (`CachedMerchant` declares them required, `cached-data.ts:635-636`), so dropping them at runtime is a **real behavioural delta**, mediated by the two derived hints.

**Data flow for the divergence-prone hints:** snapshot → `getCachedMerchant`/`getMerchantByIdentifier`/`getRequestScopedMerchant` (`cached-data.ts`) → `CachedMerchant` (adds `paystack_subaccount_configured?`, `price_negotiation_enabled?`) → `toTemplateMerchantData` (`merchant-template-data.ts`, threads both hints) → `MerchantData` (`hooks/merchant/types.ts`) → client `useMerchantSafe()` → CartSidebar/cart/checkout. **Cutting any link of this chain in isolation silently disables negotiation** for storefront merchants, because `plan_tier` is now `undefined` and the slug fallback only rescues `ogabassey`/`demo-premium` (`feature-flags.ts:208` `LEGACY_NEGOTIATION_SLUGS`).

**`cached-data.ts` is the shared spine** (1362 lines changed). It is touched by three separable concerns and therefore forces sequential ordering:
- **PART A (SAFE):** PDP-core adoption (`getCachedProductWithDetails`/`getCachedProductLcpHint` → `getCachedStorefrontPdpCore`), removal of `getCachedProduct`, category shell `use cache: remote` → local `use cache`, new `getStorefrontCategories`, `hydrateAndSanitizeProducts` made fail-loud (removes swallow-and-return-partial).
- **PART B (DIVERGENCE):** `getCachedMerchant`/`getCachedMerchantByDomain` → `readStorefrontMerchantSnapshot`, removal of the service-role client + retry/backoff/transient-error machinery, `CachedMerchant` derived hints.

---

## Files to EXCLUDE from the family plan

- **Foundation (PR-1, already sliced):** `lib/storefront-read-result.ts`, `lib/storefront-merchant-snapshot.ts`, `lib/storefront-pdp-core-snapshot.ts`, `types/storefront-database.ts` + their 3 tests.
- **Prerequisite orphan (see PR-0 below):** `types/supabase.ts` — on main this file is **empty** (`git` blob `e69de29bb2`); #3038 populates all **15,292** lines of generated types. `types/storefront-database.ts` does `Omit<Database,'public'>` importing from `./supabase`, so the foundation cannot typecheck without it. This is a repo-wide generated-types regen, not storefront-snapshot logic.

---

## PR-0 (prerequisite, chore) — populate generated Supabase types

| File | Tag | Note |
|---|---|---|
| `types/supabase.ts` | infra | Empty on main → +15,292 generated lines. Must land **before/with PR-1**; keeping it isolated stops a 15k-line generated diff from bloating every family PR. Verify it is a clean `supabase gen types` output (no hand edits). |

---

## PR-2 — SEO / crawl surface: `blog_enabled` de-duplication  ·  SAFE  ·  **independent of the spine**

These stop calling the separate `getCachedFeatureSettings(merchant.id)` and read `merchant.feature_settings?.blog_enabled`. **`CachedMerchant.feature_settings` already exists and is populated on main** (`cached-data.ts:671, 818-829`), and `getCachedFeatureSettings` is NOT deleted (still used by dashboard/blog, `api/storefront/features`, `get-published-product-guide-posts`). So this family works with **no `cached-data.ts` change** and can ship first. All read only `feature_settings.blog_enabled` — a field the snapshot definitely carries.

| Source file | Tag | Old read → new read |
|---|---|---|
| `app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-data.ts` | SAFE | `getCachedFeatureSettings(id)` (timeout+try/catch) → `merchant.feature_settings?.blog_enabled`; drops `FEATURE_SETTINGS_TIMEOUT_MS` |
| `app/(storefront)/[slug]/(blog)/blog/blog-category-hub.ts` | SAFE | same substitution |
| `app/(storefront)/[slug]/(blog)/blog/news-sitemap.xml/route.ts` | SAFE | same substitution |
| `app/(storefront)/[slug]/(blog)/blog/sitemap.ts` | SAFE | same substitution |
| `app/(storefront)/[slug]/sitemap-data.ts` | SAFE | `getCachedFeatureSettings` try/catch → `merchant.feature_settings?.blog_enabled`; **`getSitemapIndexLinks` becomes sync** (async→sync signature — callers `await`-ing a non-promise are unaffected, but confirm no `.then`/`Promise.all` typing breaks) |
| `app/robots.ts` | SAFE | same substitution |
| `lib/cached-storefront-blog-post-status.ts` | SAFE | same substitution (via `getMerchantSafe`) |
| `lib/live-blog-post.ts` | SAFE | removes try/catch feature fetch → `merchant.feature_settings?.blog_enabled` |

**Colocated tests:** `opengraph-image-data.test.ts`, `opengraph-image-data-resolution.test.ts`, `blog-category-hub.test.ts`, `news-sitemap.xml/route.test.ts`, `sitemap.test.ts`, `sitemap.category.test.ts`, `sitemap-data.test.ts`, `robots.test.ts`, `cached-storefront-blog-post-status.test.ts`, `live-blog-post.test.ts`.
**Verification:** none beyond tests. Pure lookup-elimination; the field was already resolved on the merchant.

---

## PR-3 — `cached-data.ts` SPINE PART A + PDP core cutover  ·  SAFE-with-parity  ·  touches the spine (all later spine PRs rebase on this)

Flips PDP reads to the bounded core snapshot, deletes the legacy per-slug reader, moves the category shell to local cache, adds `getStorefrontCategories`, makes product hydration fail-loud. No merchant field is dropped here.

| Source file | Tag | Old read → new read |
|---|---|---|
| `lib/cached-data.ts` (PART-A hunks only) | SAFE-with-parity | `getCachedProductWithDetails`/`getCachedProductLcpHint`: direct joins → `getCachedStorefrontPdpCore` (`readStorefrontPdpCoreSnapshot`); **`getCachedProduct` removed**; `getCachedCategoryPageShellData` `use cache: remote`→local `use cache`; add `getStorefrontCategories` (fail-open wrapper); `hydrateAndSanitizeProducts` drops swallow-and-return-partial (now throws); `getCachedProducts` propagates |
| `app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx` | SAFE | **removes the two case-insensitive lowercase-retry fallbacks** in `getProductForMerchant` + `getProductRouteControl` — snapshot normalizes the slug inside PostgreSQL. Verify PG lower-casing truly matches the old JS `toLowerCase()` for all indexed slugs |
| `app/(storefront)/[slug]/(catalog)/(pdp)/products/[productSlug]/product-page-resolution.ts` | SAFE | removes `getCachedProduct` + `mapLegacyCachedProductToProduct` legacy branch; falls straight through to `getCachedProductWithDetails` |
| `app/(storefront)/[slug]/(catalog)/(pdp)/products/[productSlug]/legacy-product-mapper.ts` **(D)** | SAFE | deleted with its last caller |
| `app/dashboard/settings/faq/page.tsx` | SAFE | wraps `getCachedProducts` in try/catch because that reader is now fail-loud; products only enrich FAQ context, never gate the page |
| **Comment-only doc-sync** (`getCachedProduct` removal + cache-directive rename — zero runtime change): `lib/cache-revalidation.ts`, `app/api/cache/revalidate/route.ts`, `app/api/internal/revalidate-products/route.ts`, `app/api/orders/route.ts`, `lib/agentic/checkout-completion-finalize.ts`, `lib/agentic/checkout-pay-on-delivery-finalize.ts`, `lib/internal-product-purge-entries.ts`, `app/api/llm/[...segments]/route.ts`, `app/(storefront)/[slug]/(catalog)/(listing)/[category]/page.tsx` | SAFE (comments) | must ride with this PR because they reference `getCachedProduct`/`use cache: remote` which this PR removes |

**Colocated tests:** `[category]/[productSlug]/page.test.tsx`, `products/[productSlug]/page.test.tsx`, `product-page-resolution.test.ts` (new), `product-page-resolution.request-scoped.test.ts`, `legacy-product-mapper.test.ts` (D), `dashboard/settings/faq/page.test.tsx` (new), plus the PDP-core-relevant `cached-data.*.test.ts`.
**Verification:** **PDP-core parity shadow-read** — the product JSON from `get_storefront_pdp_core_v2` is a new shape; diff it against the old `getCachedProductWithDetails` join for a sample of live products (variants, key-specs, offers, `variants_truncated` guard, redirect rows) before flipping.

---

## PR-4 — PDP semantic-enrichment RPC consolidation  ·  SAFE (optional/below-fold)  ·  rebases on PR-3

Collapses the categorized-PDP inventory/guide/direct fan-out into one bounded `get_storefront_pdp_semantic_enrichment_v1` POST RPC. This content is optional and fails open to `[]`; it renders below the Suspense boundary.

| Source file | Tag | Old read → new read |
|---|---|---|
| `lib/storefront-product/storefront-pdp-semantic-enrichment.ts` **(A, new)** | SAFE | new `readStorefrontPdpSemanticEnrichment` (bounded POST, 5s) returning `{guidePosts, inventory, priorityGuidePostSlugs}` |
| `lib/storefront-content/storefront-cluster-guide-request.ts` **(A, new)** | SAFE | shared `buildStorefrontClusterGuideRequest` (classifier payload builder, fail-closed for unsupported categories) |
| `lib/storefront-product/get-cached-product-seo-link-data.ts` | SAFE | `getUncachedProductSeoLinkData(...)` → `readStorefrontPdpSemanticEnrichment`; **signature change** — now takes `(merchantId, categorySlug, productId, productSlug, productBrand, blogEnabled)` where `blogEnabled` comes from `merchant.feature_settings?.blog_enabled` |
| `lib/storefront-content/get-published-cluster-posts.ts` | SAFE | inline `STOREFRONT_CLUSTER_RULES`/`buildClusterGuideSearchQuery` → shared `buildStorefrontClusterGuideRequest` |
| `lib/storefront-product/get-cached-category-scoped-semantic-inventory.ts` | SAFE | simplifies the fail-loud guard to `shell.categoryQueryFailed` only (shell reader now throws on transport failure) |
| `app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/ogabassey-pdp-semantic-sections.tsx` | SAFE | updated `getCachedProductSeoLinkData` call (drops `storeSlug`, adds `product.slug`, `product.brand`, `blog_enabled`); adds `feature_settings?.blog_enabled` to its merchant prop type |
| `lib/storefront-product/get-product-seo-link-direct-data.ts` **(D)**, `get-product-seo-link-guides.ts` **(D)**, `get-product-seo-link-inventory.ts` **(D)** | SAFE | superseded by the single enrichment RPC |

**Colocated tests:** `storefront-pdp-semantic-enrichment.test.ts` (new), `storefront-cluster-guide-request.test.ts` (new), `get-cached-product-seo-link-data.test.ts`, `get-published-cluster-posts` (n/a), `get-cached-category-scoped-semantic-inventory.test.ts`, `build-product-semantic-model.test.ts`, `ogabassey-pdp-semantic-sections.test.tsx`, and the 4 deleted `get-product-seo-link-*.test.ts`.
**Verification:** spot-check enrichment inventory/guide output vs the old three-call fan-out for a few live PDPs; confirm the POST 8 KiB classifier bound and `p_include_guides=blogEnabled` gate.

---

## PR-5 — PDP presentation: critical shell / below-fold split  ·  SAFE (presentation)  ·  rebases on PR-3/PR-4

| Source file | Tag | Change |
|---|---|---|
| `app/(storefront)/[slug]/(catalog)/(pdp)/products/[productSlug]/product-page-runtime.tsx` | SAFE | splits into `ProductPageRuntime` (critical shell: product + LCP + product/breadcrumb/offers JSON-LD, no awaits) and `ProductPageBelowFold` (reviews/semantic/guides/repairs under `<Suspense fallback={null}>`); moves live review structured data out of the offers block |
| `app/(storefront)/[slug]/(catalog)/(pdp)/products/[productSlug]/product-review-enhancement-schema.ts` **(A, new)** | SAFE | extracts `buildProductReviewEnhancementSchema` (aggregateRating + Review nodes) so review signals stream below-fold instead of mutating the product for the offers schema |

**Colocated tests:** `product-page-runtime.test.tsx`, `product-page-runtime.below-fold.test.tsx` (new), `product-review-enhancement-schema.test.ts` (new).
**Verification:** confirm offers/price JSON-LD still renders on the critical path and the review enhancement schema still URL-matches the product node.

---

## PR-6 — Compare + category navigation: fail-open categories  ·  SAFE (categories, not merchant fields)  ·  touches the spine (needs `getStorefrontCategories` from PR-3)

Reads only category data, never an omitted merchant field. The substantive change is **reliability semantics** (fail-open UI + fail-loud cache), so it needs behavioural verification, not field-parity.

| Source file | Tag | Old read → new read |
|---|---|---|
| `app/(storefront)/[slug]/(catalog)/(listing)/compare/compare-page-content.tsx` | SAFE | `getCachedCategories(id)` → `getStorefrontCategories(id)` (`{categories, queryFailed}`); adds "temporarily unavailable" copy when `queryFailed` |
| `app/(storefront)/[slug]/(catalog)/(listing)/compare/page.tsx` | SAFE | same; gates `hasActiveCompareCategory` and indexable-robots on `!queryFailed` |
| `app/(storefront)/[slug]/(catalog)/(listing)/products/products-page-content.tsx` | SAFE | `getCachedCategories` → `getStorefrontCategories` inside the `Promise.all` |
| `app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/resolve-category-compare-hub-status.ts` | SAFE | comment/logic update: `getCachedCategories` now throws on transient failure (fail-open via the internal route's catch); empty list = genuinely category-less |
| `lib/storefront-compare/get-cached-compare-category-inventory.ts` | SAFE | removes the local `categoryQueryFailed`/`scopeQueryFailed` throw (the shell reader is now fail-loud upstream) |
| `lib/storefront-compare/load-compare-page.ts`, `lib/storefront-compare/load-price-band-page.ts` | SAFE (comments) | comment-only cache-directive rename (`use cache: remote`→local) |

**Colocated tests:** `compare/compare-page-content.test.tsx`, `compare/page.metadata.test.tsx`, `compare/page.test.tsx`, `products/page.test.tsx`, `products/products-page-content.test.tsx`, `products/products-page-content-internal-links.test.tsx`, `storefront-compare/get-cached-compare-category-inventory.test.ts`, `storefront-compare/load-compare-page.test.ts`.
**Verification:** exercise a transient categories-load failure to confirm the compare index fails open (no 404/noindex) and the `queryFailed` copy renders — this is the crux of the reliability fix.

---

## PR-7 — `cached-data.ts` SPINE PART B: merchant read → snapshot  ·  DIVERGENCE-PRONE  ·  parity-gated

| Source file | Tag | Change |
|---|---|---|
| `lib/cached-data.ts` (PART-B hunks) | **DIVERGENCE** | `getCachedMerchant`/`getCachedMerchantByDomain` → `getCachedStorefrontMerchantSnapshot`(`readStorefrontMerchantSnapshot`); **removes `getServiceRoleSupabaseClient`, the retry/backoff, and the whole `isTransientMerchantLookupError` machinery**; `CachedMerchant` gains `paystack_subaccount_configured?`/`price_negotiation_enabled?`; drops runtime `plan_tier`/`premium_features` for storefront merchants |
| `lib/cached-data.test-utils.ts` | test-util | snapshot-shaped fixtures |

**Colocated tests:** `cached-data.test.ts`, `cached-data.merchant-safe.test.ts`, `cached-data.merchant-identifier-behavior.test.ts`, `cached-data.merchant-identifier-routing.test.ts`, `cached-data.category.test.ts`, `cached-data.cache-directives.test.ts`, `cached-data.products.test.ts`, `cached-data.blog-{author,listing,post,request-scoped}.test.ts`.
**Verification (mandatory shadow-read/parity):** for a representative set of published + unpublished merchants and custom-domain lookups, diff the snapshot-derived `CachedMerchant` against the current `resolve_storefront_cached_merchant` output — every allowlisted presentation field present, `feature_settings`/`custom_domain` correct, unpublished coming-soon shell (`id/business_name/slug` only) still redacts contact fields, and `price_negotiation_enabled`/`paystack_subaccount_configured` match the server evaluation.

> **Ordering note / window:** PART B removes runtime `plan_tier`. Because negotiation consumers still on `hasPriceNegotiationEntitlement(merchant.plan_tier, slug)` will read `undefined` and fall to the `{ogabassey, demo-premium}` slug allowlist, **any non-allowlisted premium merchant loses negotiation between PR-7 and PR-8**. In the NG/ogabassey pilot this is negligible, but if any non-ogabassey premium storefront is live, **combine PR-7 and PR-8 into one atomic PR**.

---

## PR-8 (LAST) — Negotiation + payment capability hints  ·  DIVERGENCE-PRONE  ·  parity-gated

Switches every consumer of the omitted `plan_tier`/`paystack_subaccount_code` to the derived snapshot hints. **Must ship with or immediately after PR-7** and stay a single unit (splitting breaks the hint chain).

| Source file | Tag | Old read → new read |
|---|---|---|
| `lib/storefront-price-negotiation.ts` **(A, new)** | **DIVERGENCE** | new `hasStorefrontPriceNegotiation(merchant)` — prefers `price_negotiation_enabled` boolean, falls back to `hasPriceNegotiationEntitlement(plan_tier, slug)` for private/dashboard callers |
| `lib/merchant-template-data.ts` | **DIVERGENCE** | threads `paystack_subaccount_configured` + `price_negotiation_enabled` into `MerchantData`; still maps `plan_tier`/`premium_features` (now `undefined` at runtime → defaults — **intentional; presentation no longer authoritative**) |
| `hooks/merchant/types.ts` | **DIVERGENCE** | adds `paystack_subaccount_configured?`/`price_negotiation_enabled?` to `MerchantData` |
| `components/storefront/ogabassey/components/CartSidebar.tsx` | **DIVERGENCE** | `hasPriceNegotiationEntitlement(merchant?.plan_tier, merchant?.slug)` → `hasStorefrontPriceNegotiation(merchant)` |
| `components/storefront/ogabassey/pages/cart-page.tsx` | **DIVERGENCE** | same |
| `components/storefront/ogabassey/pages/checkout-page.tsx` | **DIVERGENCE** | same |
| `components/storefront/ogabassey/pages/checkout/components/PaymentStep.tsx` | **DIVERGENCE** | merchant prop type gains `paystack_subaccount_configured?` |
| `lib/checkout/payment-gateway-availability.ts` | **DIVERGENCE** | `isPaystackCheckoutAvailable`: `Boolean(paystack_subaccount_code?.trim())` → `... || paystack_subaccount_configured === true` (raw code no longer crosses the anon boundary) |

**Colocated tests:** `storefront-price-negotiation.test.ts` (new), `CartSidebar.test.tsx`, `cart-page.test.tsx`, `checkout/payment-gateway-availability.test.ts`. (No test files exist for `checkout-page.tsx`, `PaymentStep.tsx`, `merchant-template-data.ts`, `hooks/merchant/types.ts` in this diff.)
**Verification (mandatory):** live parity that a snapshot-sourced storefront merchant still shows negotiation UI and Paystack availability exactly as with raw fields, for both a negotiation-enabled and a disabled merchant; confirm private negotiation/order APIs (`api/orders/route.ts`, still on `hasPriceNegotiationEntitlement`) remain authoritative and unchanged.

---

## Risks / bugs to flag in #3038 itself, and orphans

1. **Latent regression NOT covered by the PR — `hooks/use-merchant-features.tsx` (unchanged).** It reads `merchant.plan_tier` (`:64-66`) to compute the storefront plan tier. Once PR-7 lands, that value is `undefined` for snapshot merchants, so it falls to the same `['ogabassey','demo-premium']` slug allowlist. **Any non-ogabassey premium storefront silently drops to `'free'` for ALL `useMerchantFeatures()`-gated features, not just negotiation.** The PR added a derived hint for negotiation but did not give `useMerchantFeatures` an equivalent. **Recommend:** either fold a `use-merchant-features` cutover to a derived capability into PR-8, or explicitly confirm no non-ogabassey premium storefront depends on it. (`merchant-feature-gates.ts` reads `premium_features`/`plan_tier` too, but is a dashboard/authoritative-row path — verify it never runs against a snapshot merchant.)

2. **`types/supabase.ts` (+15,292, empty on main) is an out-of-band prerequisite, not a consumer.** Treat as PR-0. Do not let it ride inside a family PR — it will drown the reviewable diff and it gates the foundation's typecheck.

3. **Cross-PR coupling with #3053.** The `use cache: remote → local use cache` comment/directive changes in `[category]/page.tsx`, `api/llm/[...segments]/route.ts`, `load-compare-page.ts`, `load-price-band-page.ts` document the `getCachedCategoryPageShellData` directive flip that **is** in this PR's `cached-data.ts` (PART A). But the PR body says the compare-graph CPU fix lives in the separate #3053. Confirm PR-3 and #3053 do not both edit the category-shell cache mode (double-flip / merge-conflict risk).

4. **`sitemap-data.ts` async→sync signature change** (`getSitemapIndexLinks`) is the only SEO-family change with a shape (not just body) delta — verify all callers before landing PR-2.

5. **No true orphans beyond the above.** Every remaining changed source file maps to a family; the comment-only cluster is bucketed with the change it documents (PR-3 for `getCachedProduct`/cache-directive, PR-6 for the compare cache-directive comments).

### Recommended merge order
PR-0 (types) → PR-1 (foundation, given) → **PR-2 (SEO, safest/independent)** → PR-3 (spine A + PDP core) → PR-4 (PDP enrichment) → PR-5 (PDP presentation) → PR-6 (compare/categories) → **PR-7 + PR-8 combined or adjacent (merchant-snapshot spine + negotiation/payment, divergence-prone, LAST)**. PRs 3, 6, 7 all edit `cached-data.ts`, so they must be strictly sequential and rebased; 4 and 5 can be parallel once 3 lands. Every DIVERGENCE PR (3-parity, 6-behaviour, 7, 8) needs the shadow-read/parity check noted in its row.
