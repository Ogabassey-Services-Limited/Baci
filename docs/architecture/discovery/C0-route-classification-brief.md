# C0 — Route-Classification Feasibility Brief

**Goal:** give `proxy.ts` a machine-readable public-cacheable / public-no-store / private route classification from a *supported* source, with no runtime `.next` manifest reads. Read from `origin/main` (`c8108a052d`).

**Bottom line: feasible and low-risk.** `proxy.ts` already imports plain typed constants from `@/config/*` (e.g. `@/config/storefront-cache`), which Next bundles into the middleware at build time. A build-time-generated typed `.ts` artifact under `src/config/` is therefore importable identically — zero runtime manifest read, edge/Node-runtime-agnostic as long as the artifact is a pure constant module. The route tree is small (74 storefront `page.tsx`/`route.ts`), and the monorepo already has a filesystem-tree-walking drift test precedent (`apps/web`… no — `apps/mobile-admin/scripts/expo-router-app-tree.test.ts`) that a storefront drift test can mirror.

---

## 1. Current hand-maintained sets in `proxy.ts`

File: `/Users/mac/Baci-app/apps/web/src/proxy.ts`. Classification-relevant sets (line numbers on `origin/main`):

| Set (line) | Members | What it classifies |
|---|---|---|
| `NESTED_PRODUCT_SUBROUTE_EXCLUSIONS` (289) | `best-under`, `compare` | 3-segment `/{category}/{sub}/{x}` paths that are **SEO listing subroutes, not category-PDPs** — excluded from product-slug resolution and given the legacy `s-maxage=300` cacheable header instead of Ops-2 split headers. |
| `CATEGORY_LISTING_HUB_SEGMENTS` (297) | `compare` | Narrower: 2-segment `/{category}/compare` is the live per-category compare hub (`(catalog)/(listing)/[category]/compare/page.tsx`) — must not be PDP-preflighted (would false-404/308). `best-under` deliberately excluded (no 2-segment route). |
| `RESERVED_STOREFRONT_SEGMENTS` (645) | `about, account, api, blog, cart, category, checkout, faq, llms-full.txt, llms.txt, pages, privacy-policy, product-category, products, repair, repairs, robots.txt, sitemap, swap, terms, track-order, wallet, wishlist` | First segments that are **real routes / structural names**, so a merchant-slug prefix must NOT be collapsed to `/products/{slug}`, home-doc detection must exclude them, and metadata cache must not partition them as product URLs. This is the multi-purpose "not a product/category slug" spine. |
| `CACHEABLE_PUBLIC_STOREFRONT_FIRST_SEGMENTS` (677) | `about, blog, contact, faq, privacy, privacy-policy, products, returns, shipping, terms, terms-and-conditions, terms-of-service, warranty` | Single-segment **public documents safe to edge-cache for every tenant** (`blog` also allowed multi-segment). |
| `NON_CACHEABLE_STOREFRONT_FIRST_SEGMENTS` (732) | `…RESERVED_STOREFRONT_SEGMENTS` + `product, my-account, delete-account, receipts, order-success, member-status, imei-check, quiz, reviews` | First segments that must **NEVER be edge-cached** — reserved spine plus the per-user `(customer)/(commerce)/(utility)` groups. The canonical `/{category}/{product}` PDP shape is intentionally *absent* so it stays cacheable. |
| `STOREFRONT_ROUTE_FIRST_SEGMENTS` (759) | `…NON_CACHEABLE` + `compare, search, contact, privacy, returns, shipping, warranty, terms-and-conditions, terms-of-service, storefront` | Superset — **every** first segment that resolves to a real `(storefront)/[slug]` route. Used only by the retired-slug prefix strip so a live route on a custom domain isn't mistaken for a legacy `/{oldSlug}/…` link. |
| `CUSTOM_DOMAIN_APP_ROUTE_FIRST_SEGMENTS` (784) | `auth, feeds` | Platform routes reachable on a custom domain but *not* `(storefront)/[slug]` routes — also excluded from the retired-slug strip. |
| `STOREFRONT_METADATA_CACHE_NON_SEO_SEGMENTS` (385) | `account, cart, checkout, delete-account, my-account, order-success, receipts, track-order, wallet, wishlist` | First segments excluded from bot metadata-cache partitioning (the private set, effectively). |
| `PLATFORM_ROOT_ROUTE_SEGMENTS` (397) | `_next, about, admin, api, auth, blog, builder, cart, checkout, contact, debug-auth, delete-account, demo, developers, features, favicon.ico, feeds, forgot-password, invite, login, manifest.webmanifest, onboarding, pricing, privacy, products, reset-password, robots.txt, signup, sitemap.xml, staff, template-preview, terms, track, update-password, verify` | Root-domain (non-storefront) first segments — used to reject slug/home detection on the platform host. Out of scope for storefront classification but overlaps and must stay reconciled. |

**Per-tenant data (not route-derived):** `@/config/storefront-cache.ts` `STOREFRONT_PUBLIC_CACHE_POLICIES` holds `cacheableCategorySegments` for `ogabassey` (28 category slugs taken from the live products sitemap) plus custom hostnames. This is **catalog data, not tree structure** — it cannot and must not be generated from the app/ tree.

**How they drive the four cache dispositions** (`buildStorefrontDocumentCacheHeaders`, `@/config/storefront-cdn-cache-control.ts`): `cacheable` (long: browser `max-age=0,must-revalidate` + `Vercel-CDN max-age=300,swr=86400` + `CDN max-age=3600,swr,sie`), `cacheable-self-healing` (PDP/uncertain: CDN `max-age=300`), `cacheable-vercel-only` (non-policy tenant: no `CDN-Cache-Control`), `non-cacheable` (`private, no-store, max-age=0, must-revalidate`, both CDN headers deleted).

---

## 2. The `(storefront)/[slug]` route tree → current class

Route groups under `apps/web/src/app/(storefront)/[slug]/` and their **effective** disposition today:

| Group / route | Public-cacheable | Public-no-store | Private | Notes |
|---|:--:|:--:|:--:|---|
| `(home)` `/` | ✅ (long) | | | home document |
| `(blog)` `/blog`, `/blog/[postSlug]`, `/blog/author/[…]`, `/blog/category/[…]` | ✅ (long, multi-seg) | | | `news-sitemap.xml`, `opengraph-image`, feed = non-HTML public |
| `(catalog)/(listing)/products` | ✅ (long) | | | products listing |
| `(catalog)/(listing)/[category]` | ✅ (tenant allowlist, self-healing) | | | cached only for slugs in `STOREFRONT_PUBLIC_CACHE_POLICIES` |
| `(catalog)/(listing)/[category]/compare` + `/compare/[comparisonSlug]` | ✅ (legacy `s-maxage=300`) | | | SEO listing subroute, not Ops-2 |
| `(catalog)/(listing)/[category]/best-under/[priceBandSlug]` | ✅ (legacy `s-maxage=300`) | | | SEO listing subroute |
| `(catalog)/(listing)/compare` (top-level) | | ⚠️ (served no-store today) | | **gap**: public but uncached — `compare` not in cacheable set |
| `(catalog)/(listing)/search` | | ✅ | | correct — query-driven |
| `(catalog)/(pdp)/[category]/[productSlug]` | ✅ (self-healing) | | | canonical PDP |
| `(catalog)/(pdp)/products/[productSlug]` | ✅ | | | plural PDP |
| `(catalog)/(pdp)/product/[productSlug]` | | ✅ (redirect-only/noindex) | | legacy singular → keep no-store |
| `(content)` `about, contact, faq, privacy, privacy-policy, returns, shipping, terms, terms-and-conditions, terms-of-service, warranty` | ✅ (long, single-seg) | | | trust pages |
| `(content)/pages/{about,blog,contact,faq,privacy,rewards,terms}` | | ⚠️ (no-store) | | **gap**: public content served no-store because `pages` is reserved |
| `(commerce)` `cart, checkout(+bnpl/crypto/success), order-success, track-order, wallet, wishlist` | | | ✅ | never cache |
| `(customer)` `account/*, delete-account, my-account/*, receipts/*` | | | ✅ | per-user; `account/callback` is an OAuth route |
| `(utility)` `imei-check, member-status, quiz, reviews` | | ⚠️/✅ | ⚠️ | user/session-specific; correctly no-store |
| `(utility)` `repair, repair/status, repairs, repairs/[deviceSlug], swap` | | ✅ (public dynamic) | | catalog/booking; public but no-store via reserved spine |

**Key structural finding:** the current sets collapse **two semantically distinct** no-store classes into one (`non-cacheable`): genuinely *private* per-user routes (`account`, `receipts`, `checkout`, `wallet`) and *public-but-dynamic* routes (`search`, top-level `compare`, `repairs`, `pages/*`). For cache headers this is harmless today, but it is exactly the distinction B3's collision tests and any future "safe to prerender / safe to log URL / Vary policy" logic need. The proposed schema makes it explicit.

---

## 3. Proposed semantic schema

A single discriminated class per storefront **first segment** (plus a small nested-subroute table), decoupled from the header mechanics so `proxy.ts` maps class → `StorefrontDocumentCacheKind` in one place.

```ts
// apps/web/src/config/storefront-route-classification.generated.ts  (GENERATED — do not edit)

export type StorefrontRouteVisibility = 'public' | 'private';

export type StorefrontRouteClass =
  | 'public-cacheable-document'  // home, single-seg content, products, blog(*), tenant category
  | 'public-cacheable-pdp'       // [category]/[productSlug], products/[productSlug]
  | 'public-cacheable-listing'   // nested SEO subroutes: [category]/compare(/*), [category]/best-under/*
  | 'public-no-store'            // search, top-level compare, pages/*, repairs, repair, swap
  | 'redirect-only'              // product/[slug] (legacy singular, noindex)
  | 'private';                   // (commerce) + (customer) + user-specific (utility)

export interface StorefrontFirstSegment {
  readonly segment: string;
  readonly class: StorefrontRouteClass;
  readonly visibility: StorefrontRouteVisibility;
  /** True when the segment is a structural route name (never a product/category slug). */
  readonly reserved: boolean;
  /** True when the route legitimately serves nested paths (blog, category, pdp). */
  readonly acceptsNestedSubroute: boolean;
  /** Route group it derives from, e.g. '(commerce)'. Diagnostic / drift anchor. */
  readonly group: string;
}
```

**Dimensional model** — three orthogonal facts per segment, all recoverable by proxy.ts from one record:

1. **`class`** → cache disposition. `proxy.ts` keeps the tenant-policy overlay (`cacheable` vs `cacheable-vercel-only` vs `cacheable-self-healing`) because that depends on `STOREFRONT_PUBLIC_CACHE_POLICIES` data, not the tree. The artifact only says *what kind of route this is*; the header tier is still chosen at request time.
2. **`visibility`** → the private/public split the current binary set loses. `private` ⇒ no-store **and** `Vary: Cookie` on auth hint **and** excluded from metadata partitioning. `public-no-store` ⇒ no-store but not user-private.
3. **`reserved`** → the existing multi-use "not a product slug" bit (slug-prefix strip, home detection, PDP preflight). Every class except `public-cacheable-pdp` and the tenant-category variant of `public-cacheable-document` is reserved.

The existing sets become **derived views** over this one array (keeps every current call site working):

```ts
export const RESERVED_STOREFRONT_SEGMENTS = new Set(
  FIRST_SEGMENTS.filter(s => s.reserved).map(s => s.segment));
export const NON_CACHEABLE_STOREFRONT_FIRST_SEGMENTS = new Set(
  FIRST_SEGMENTS.filter(s => s.class !== 'public-cacheable-document'
    && s.class !== 'public-cacheable-pdp').map(s => s.segment));
export const CACHEABLE_PUBLIC_STOREFRONT_FIRST_SEGMENTS = new Set(
  FIRST_SEGMENTS.filter(s => s.class === 'public-cacheable-document').map(s => s.segment));
export const STOREFRONT_ROUTE_FIRST_SEGMENTS = new Set(FIRST_SEGMENTS.map(s => s.segment));
```

Nested subroutes (`NESTED_PRODUCT_SUBROUTE_EXCLUSIONS`, `CATEGORY_LISTING_HUB_SEGMENTS`) become a second small generated table keyed by the 2nd segment with `has2SegmentRoute` / `has3SegmentRoute` flags (`compare` = both, `best-under` = 3-seg only).

---

## 4. Recommended source / generator approach

**Route-group naming alone is insufficient** (option 3b in the task): the group name derives the default class for ~90% of routes, but ~8 segments are ambiguous within their group — `search` and top-level `compare` inside `(listing)`, the singular `product/` inside `(pdp)`, `pages/*` inside `(content)`, and the public-dynamic vs user-specific split inside `(utility)`. Reclassifying by renaming route groups would touch many files and risk the `proxy.ts` preflight logic. **Reject pure-convention.**

**Recommended: hybrid generator = route-group default + a co-located override manifest.**

- **Generator** (new): `apps/web/src/scripts/generate-storefront-route-classification.ts` (run via `tsx`, matching the existing `verify:*`/`process:*` script convention in `apps/web/package.json`). It:
  1. Walks `apps/web/src/app/(storefront)/[slug]/**` with `node:fs` (same technique as `apps/mobile-admin/scripts/expo-router-app-tree.test.ts`), collecting `page.tsx`/`route.ts` leaf paths.
  2. Extracts `(group)` and first real path segment for each, applies **group defaults**: `(commerce)`/`(customer)` → `private`; `(home)`/`(blog)`/`(content)` → `public-cacheable-document`; `(pdp)` → `public-cacheable-pdp`; `(listing)` → `public-cacheable-document`; `(utility)` → `public-no-store`. Dynamic catalog roots such as `(listing)/[category]` and `(pdp)/[category]/[productSlug]` are emitted as explicit wildcard catalog patterns, never as a literal `[category]` first-segment record; unknown first segments continue through the tenant category/PDP overlay.
  3. Applies **explicit overrides** from a single co-located source-of-truth file, `apps/web/src/app/(storefront)/route-class-overrides.ts` (lives next to the routes, reviewed in the same PR as any route change): `{ 'product': 'redirect-only', 'search': 'public-no-store', 'compare': 'public-no-store', 'pages': 'public-no-store', 'member-status': 'private', 'quiz': 'private', 'reviews': 'private', 'imei-check': 'public-no-store' }`. Small, explicit, greppable.
  4. Emits the typed constant module (Section 5) plus the derived Sets, with a `// GENERATED … do not edit` banner and runs Biome format on it.
- **`proxy.ts` import:** replace the eight hand-written `new Set([...])` literals with imports from `@/config/storefront-route-classification.generated`. This is the *same* import shape as the existing `@/config/storefront-cache` import at `proxy.ts:19`, so no runtime/bundling change — Next inlines the constants into the compiled middleware. No `.next` read, no fs at request time.
- **Scope boundary (important):** the generator emits **structural first-segment + nested-subroute** classification only. `STOREFRONT_PUBLIC_CACHE_POLICIES` / `cacheableCategorySegments` (per-tenant catalog data) **stay hand-maintained** in `storefront-cache.ts` — they are sitemap-derived, not tree-derived. Document this boundary in both files.

**Why not a `prebuild` fs-walk inside proxy.ts:** rejected by the task premise (no runtime manifest / fs reads) and correct — middleware must stay pure. Generation happens once, at author time, committed to git; the drift test guarantees freshness.

---

## 5. Typed-artifact shape (concrete)

```ts
// apps/web/src/config/storefront-route-classification.generated.ts
// GENERATED by scripts/generate-storefront-route-classification.ts — do not edit by hand.
// Regenerate: pnpm --filter @baci/web exec tsx src/scripts/generate-storefront-route-classification.ts

export type StorefrontRouteVisibility = 'public' | 'private';
export type StorefrontRouteClass =
  | 'public-cacheable-document' | 'public-cacheable-pdp' | 'public-cacheable-listing'
  | 'public-no-store' | 'redirect-only' | 'private';

export interface StorefrontFirstSegment {
  readonly segment: string;
  readonly class: StorefrontRouteClass;
  readonly visibility: StorefrontRouteVisibility;
  readonly reserved: boolean;
  readonly acceptsNestedSubroute: boolean;
  readonly nestedClass?: StorefrontRouteClass;
  readonly group: string;
}

export const STOREFRONT_FIRST_SEGMENTS = [
  { segment: 'account',       class: 'private',                  visibility: 'private', reserved: true,  acceptsNestedSubroute: true,  group: '(customer)' },
  { segment: 'cart',          class: 'private',                  visibility: 'private', reserved: true,  acceptsNestedSubroute: false, group: '(commerce)' },
  { segment: 'checkout',      class: 'private',                  visibility: 'private', reserved: true,  acceptsNestedSubroute: true,  group: '(commerce)' },
  { segment: 'blog',          class: 'public-cacheable-document', visibility: 'public', reserved: true,  acceptsNestedSubroute: true,  group: '(blog)' },
  { segment: 'products',      class: 'public-cacheable-document', visibility: 'public', reserved: true,  acceptsNestedSubroute: true, nestedClass: 'public-cacheable-pdp', group: '(catalog)/(listing)+(pdp)' },
  { segment: 'search',        class: 'public-no-store',          visibility: 'public',  reserved: true,  acceptsNestedSubroute: false, group: '(catalog)/(listing)' },
  { segment: 'compare',       class: 'public-no-store',          visibility: 'public',  reserved: true,  acceptsNestedSubroute: false, group: '(catalog)/(listing)' },
  { segment: 'product',       class: 'redirect-only',            visibility: 'public',  reserved: true,  acceptsNestedSubroute: true,  group: '(catalog)/(pdp)' },
  { segment: 'pages',         class: 'public-no-store',          visibility: 'public',  reserved: true,  acceptsNestedSubroute: true,  group: '(content)' },
  { segment: 'about',         class: 'public-cacheable-document', visibility: 'public', reserved: true,  acceptsNestedSubroute: false, group: '(content)' },
  // …every first segment enumerated exhaustively…
] as const satisfies readonly StorefrontFirstSegment[];

// Dynamic route leaves are patterns, not reserved literal first segments.
export const STOREFRONT_DYNAMIC_CATALOG_PATTERNS = [
  { pattern: '/[category]', class: 'public-cacheable-listing' },
  { pattern: '/[category]/[productSlug]', class: 'public-cacheable-pdp' },
] as const;

export const STOREFRONT_FIRST_SEGMENT_BY_NAME =
  new Map(STOREFRONT_FIRST_SEGMENTS.map(s => [s.segment, s]));

// Nested-subroute table (2nd segment of /{category}/{sub}[/{x}])
export interface StorefrontNestedSubroute {
  readonly segment: string;             // e.g. 'compare' | 'best-under'
  readonly class: 'public-cacheable-listing';
  readonly has2SegmentRoute: boolean;   // /{category}/{sub}
  readonly has3SegmentRoute: boolean;   // /{category}/{sub}/{x}
}
export const STOREFRONT_NESTED_SUBROUTES = [
  { segment: 'compare',    class: 'public-cacheable-listing', has2SegmentRoute: true,  has3SegmentRoute: true },
  { segment: 'best-under', class: 'public-cacheable-listing', has2SegmentRoute: false, has3SegmentRoute: true },
] as const satisfies readonly StorefrontNestedSubroute[];

// Derived compatibility views (keep existing proxy.ts call sites unchanged):
export const RESERVED_STOREFRONT_SEGMENTS: ReadonlySet<string> = /* filter reserved */;
export const CACHEABLE_PUBLIC_STOREFRONT_FIRST_SEGMENTS: ReadonlySet<string> = /* … */;
export const NON_CACHEABLE_STOREFRONT_FIRST_SEGMENTS: ReadonlySet<string> = /* … */;
export const STOREFRONT_ROUTE_FIRST_SEGMENTS: ReadonlySet<string> = /* all names */;
export const NESTED_PRODUCT_SUBROUTE_EXCLUSIONS: ReadonlySet<string> = /* subroute names */;
export const CATEGORY_LISTING_HUB_SEGMENTS: ReadonlySet<string> = /* has2SegmentRoute */;
```

`as const satisfies` gives compile-time exhaustiveness and keeps every literal narrow, so `proxy.ts` type-checks against the class union.

---

## 6. CI drift-check approach

**Primary: generator `--check` in an always-run web verification step.** The current PR test planner uses `vitest run --changed "$TURBO_SCM_BASE"`; [Vitest's current CLI contract](https://vitest.dev/guide/cli) filters the test-file set under `--changed`, so a newly added route does not reliably select an otherwise unchanged drift test. Wire `verify:route-classification` into CI independently of targeted Vitest selection whenever web route/config inputs change (or include its inputs in an explicit always-run verify job). The command derives to memory/temp output and diffs the committed artifact.

`apps/web/src/config/storefront-route-classification.generated.test.ts`:
1. Import the **pure derivation function** the generator uses (extract `deriveStorefrontRouteClassification()` into a shared, testable module so the generator and the test call the identical logic).
2. Walk `app/(storefront)/[slug]/**` at test time (fs), re-derive the artifact in memory.
3. `expect(reDerived).toEqual(committed)` — fails if a route was added/removed/moved without regenerating. Error message: "run `tsx src/scripts/generate-storefront-route-classification.ts`".
4. **Completeness assertion:** every discovered leaf route maps to exactly one first-segment record and the override manifest has no stale keys (an override for a segment that no longer exists → fail). This closes the "new route added, nobody classified it" hole — a brand-new `(commerce)/refund/` folder fails CI until classified.
5. **Invariant assertions** (independent of the tree, catch bad overrides): no `private` segment is also in any cacheable-view Set; every `private` segment has `visibility:'private'`; `public-cacheable-*` implies `visibility:'public'`.

**Secondary:** retain the colocated Vitest derivation/invariant suite for focused local diagnostics, but do not treat targeted Vitest as the freshness gate. `forceRerunTriggers` is an acceptable alternative only if route-tree and manifest changes are exhaustively included and tested; the explicit generator check is the simpler contract.

**Reconciliation guard:** add an assertion that `PLATFORM_ROOT_ROUTE_SEGMENTS` ∩ storefront-private segments stay consistent (both list `cart`, `checkout`, `account`, etc.), so the root-domain and storefront classifications don't silently diverge.

---

## 7. Private-route collision test list for B3

B3 must lock in that **private / reserved first segments are never edge-cached and never hijacked by a product or category that happens to share the name.** Test against both URL shapes: custom domain `https://ogabassey.com/{path}` and slug-prefixed `https://{ROOT_DOMAIN}/ogabassey/{path}` (proxy handles both via `isSlugPrefixedStorefrontRequest`). The existing `proxy.test.ts` (`origin/main` ~line 3019) already covers a subset — B3 extends it to the full private set plus the two collision directions.

**A. Private first-segment → must be `private, no-store, max-age=0, must-revalidate`, `Vercel-CDN-Cache-Control`=null, `CDN-Cache-Control`=null** (single- and multi-segment):
- `/cart`, `/checkout`, `/checkout/bnpl`, `/checkout/crypto`, `/checkout/success`
- `/order-success`, `/order-success/abc-123`
- `/track-order`
- `/wallet`, `/wishlist`
- `/account`, `/account/orders`, `/account/orders/o-123`, `/account/orders/o-123/insurance`, `/account/addresses`, `/account/settings`, `/account/login`
- `/my-account`, `/my-account/profile`
- `/delete-account`
- `/receipts`, `/receipts/claim/tok-123`, `/receipts/abc-123`
- `/member-status`, `/quiz`, `/reviews`

**B. Public-no-store (must stay no-store, but assert `Vary: Cookie` is NOT added when there's no auth hint — distinct from private):**
- `/search`, `/compare` (top-level), `/imei-check`, `/repairs`, `/repairs/iphone-15`, `/repair`, `/repair/status`, `/swap`, `/pages/about`, `/pages/rewards`
- `/product/samsung-galaxy-z-fold-4` (redirect-only legacy singular)

**C. Auth-session hint on a private path → still no-store AND `Vary: Cookie`** (cookie `sb-…-auth-token`, header `x-supabase-auth-token`, `authorization: Bearer …`):
- `/account/orders`, `/receipts`, `/wallet`, `/checkout` — each with each auth-hint variant.

**D. Collision — merchant names a PRODUCT/CATEGORY the same as a reserved segment (the actual C0/B3 hazard):**
- `/cart`, `/checkout`, `/account`, `/receipts` when a category or product with that literal slug exists → must resolve to the **private route**, NOT a PDP/category; assert no-store, no 308/404 hijack from the product-slug preflight.
- **Inverse (must NOT be over-reserved):** a *product* whose slug equals a reserved name, sitting under a real category, must stay a **cacheable PDP** — reservation is FIRST-segment only:
  - `/smartphones/checkout`, `/smartphones/account`, `/laptops/wallet` → `public-cacheable-pdp` headers (`public, max-age=0, must-revalidate` + split CDN), **not** no-store. This is the highest-value regression guard: it proves the private set doesn't leak into 2nd-segment product-slug space.
- `/{category}/compare` and `/{category}/best-under/{band}` where `{category}` collides with a reserved name are possible today because category creation slugifies names without a reserved-segment denylist. Include `/checkout/compare`, `/receipts/compare`, `/checkout/best-under/500000`, and equivalent custom-domain/slug-prefixed cases; these nested hub shapes must classify as `public-cacheable-listing` rather than inheriting the private class of the same first segment's single-level app route. Also assert `/smartphones/compare` stays `public-cacheable-listing` (`s-maxage=300`) and is not treated as a PDP.

**E. Retired-slug strip must not break live private/app routes** (a store once slugged `auth`/`feeds`/`account` on its custom domain):
- `custom.example/auth/confirm`, `custom.example/feeds/google`, `custom.example/account/orders` → route survives (no prefix strip to `/confirm` etc.).

**F. Query / non-canonical on a would-be-cacheable path stays no-store** (already partially covered):
- `/smartphones/samsung-galaxy-z-fold-4?variantId=x`, `/blog?utm_source=x` → no-store, no CDN headers.

---

## Files referenced (absolute paths)

- `/Users/mac/Baci-app/apps/web/src/proxy.ts` — sets at lines 289, 297, 385, 397, 645, 677, 732, 759, 784; class→header logic at ~4490–4570; classifier helpers ~440–1090.
- `/Users/mac/Baci-app/apps/web/src/config/storefront-cache.ts` — per-tenant `STOREFRONT_PUBLIC_CACHE_POLICIES` (stays hand-maintained).
- `/Users/mac/Baci-app/apps/web/src/config/storefront-cdn-cache-control.ts` — `StorefrontDocumentCacheKind` + `buildStorefrontDocumentCacheHeaders`.
- `/Users/mac/Baci-app/apps/web/src/proxy.test.ts` — existing cache-behavior tables (~2930–3095) B3 extends.
- `/Users/mac/Baci-app/apps/mobile-admin/scripts/expo-router-app-tree.test.ts` — fs-tree-walk drift-test precedent to mirror.
- `/Users/mac/Baci-app/apps/web/package.json` — `verify:quiz-assets` / `tsx src/scripts/*` script precedent for the generator + `--check`.
- `/Users/mac/Baci-app/.github/workflows/ci.yml` — `quality-test` runs `turbo test`; the Vitest drift test rides it with no new wiring.
- **Proposed new:** `apps/web/src/config/storefront-route-classification.generated.ts` (artifact), `apps/web/src/config/storefront-route-classification.derive.ts` (shared pure derivation), `apps/web/src/scripts/generate-storefront-route-classification.ts` (generator + `--check`), `apps/web/src/app/(storefront)/route-class-overrides.ts` (co-located override manifest), `apps/web/src/config/storefront-route-classification.generated.test.ts` (drift + invariants).
