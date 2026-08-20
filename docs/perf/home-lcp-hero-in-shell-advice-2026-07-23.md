# Advisory: Rendering the Cached Hero Image in the Home PPR Static Shell (2026-07-23)

**Scope:** ogabassey.com home LCP. Read-only review; no code changed. Companion to
`docs/perf/cwv-ttfb-findings-review-2026-07-23.md` (which identified renderDelay as the largest
addressable LCP subpart — this note answers the question that review left open).

**Question:** the static shell already resolves `heroShell.status === 'published'` from cache and
already preloads the slide-0 image. What is the *marginal* risk of also **painting** that image in
the shell (LCP ≈ FCP), keeping all product/PDP/interactive UI behind the request-scoped gate?

**Verdict: (A) — SAFE, with the image-only constraint below. The publication gate's "live" check
reads the *same cache* as the shell, so withholding the pixels buys almost no safety; the real
publication guarantee is the fail-loud foreground purge, which protects both paths equally.**

---

## 1. The decisive fact: the staleness bound

### 1a. What the shell trusts

`resolveOgabasseyHomeHeroShell()`
(`apps/web/src/app/(storefront)/ogabassey/ogabassey-home-hero-shell-data.ts`) reads
`getCachedMerchant('ogabassey')` — hardcoded `OGABASSEY_MERCHANT_SLUG`, 500 ms budget, degrade to
`null` — and checks `merchant.is_published !== true`. That lookup
(`apps/web/src/lib/cached-data.ts` ~line 750) is:

```
'use cache';            // LOCAL Cache Components cache (deliberately not remote)
cacheLife('merchant');  // next.config.ts line 166: { stale: 300, revalidate: 60, expire: 3600 }
cacheTag('merchants', `merchant-${slug}`); … cacheTag(`features-${merchant.id}`);
```

Underlying status source: the bounded public snapshot RPC
`resolve_storefront_public_snapshot_v2` (`apps/web/src/lib/storefront-merchant-snapshot.ts`) —
anon-scoped public columns only; no sensitive-column concern here (the bvn/bank column-exposure
work is a different surface entirely).

**Passive bound:** server SWR every **60 s**, hard expiry **3600 s**, client/router staleness
300 s. The prerendered shell HTML additionally sits at Vercel/Cloudflare CDN with
`cdn-cache-control: max-age=3600, stale-while-revalidate=86400` (verified by probe in the
2026-07-23 review).

### 1b. But the passive bound is not the operative bound

Publication transitions do **not** rely on SWR. Both `POST` (publish) and `DELETE` (unpublish) in
`apps/web/src/app/api/merchant/publish/route.ts` (lines 279, 384) **await**
`evictStorefrontPublicationCaches`
(`apps/web/src/lib/storefront-publication-cache-eviction.ts`), which runs inner→outer:

1. `revalidateMerchantPublication` (`apps/web/src/lib/cache-revalidation.ts` line 111) —
   hard-expires every publication tag with `{ expire: 0 }` (explicitly *not* SWR: "Publication
   transitions must never use stale-while-revalidate"). Tags cover `merchant-ogabassey`,
   `merchant-id-*`, `features-*`, every `domain-*` alias
   (`buildMerchantPublicationDataCacheTags`).
2. Vercel tag deletion — "Data, Runtime, and CDN caches together" (covers the local
   `'use cache'` runtime entries *and* the prerendered shell HTML, via the hostname/slug response
   tags from `buildStorefrontPublicationCacheTags`).
3. Confirmed Cloudflare hostname purge — awaited *after* Vercel so the edge cannot refill stale.

It is **fail-loud**: any stage failure returns an error response to the merchant
(`storefrontCacheEvictionFailureResponse`), i.e. the merchant is told the unpublish did not fully
propagate and can retry.

**So the real stale-shell window is:**

| Scenario | Window in which cache still says 'published' |
|---|---|
| Normal unpublish (purge succeeds) | ~seconds (foreground purge latency) |
| Purge fails after DB update (merchant sees an error) | ≤ 60 s typical (SWR) for runtime caches; up to 3600 s for the CDN-cached shell HTML if *both* Vercel and CF purges failed |
| Absolute pathological cap | `expire: 3600` (data) / CDN `max-age=3600` |

### 1c. The symmetric fact that decides the question

The "live" gate in `ogabassey-home-page-content.tsx` — `await connection()` + `headers()` +
`getRequestScopedMerchant(...)` + `is_published` — is **not a live database read**.
`getRequestScopedMerchant` (`cached-data.ts` line 877) is `React.cache(getMerchantSafe)` →
`getMerchantByIdentifier` → **the same `'use cache'` + `cacheLife('merchant')` functions**
(`getCachedMerchant` / `getCachedMerchantByDomain`).

Therefore, in *any* window in which the shell's cache stalely says 'published', the dynamic
subtree will typically read equally stale data and render the **full** `<Hero>` — image, product
names, prices, and PDP `<Link>`s (`hero-mobile-carousel.tsx` lines 138–198) — a strictly larger
disclosure than the image alone. What `connection()` actually buys is **not freshness**; it buys:

- per-request **host/tenant resolution** (`resolveMerchantContextIdentifier(headersList)`), and
- the `shellMerchantId === merchant.id` **tenant binding** before any shopping UI renders, and
- execution *outside* the CDN-frozen HTML (so the only marginal window for the shell is "CDN
  shell HTML older than the lambda's runtime cache" — bounded by 1b and closed by the same purge).

## 2. Marginal risk of painting the image (Q1)

What the static shell **already** does today in a stale window
(`ogabassey-static-home-page-content.tsx` — its own comment at lines 41–47 acknowledges this):

- discloses the published/unpublished decision (skeleton vs nothing) and the slide count
  (`hasCarouselControls`),
- emits the slide-0 image URL into the HTML, and
- **forces every visitor's browser to fetch the image bytes at `fetchPriority: 'high'`**
  (`preloadOgabasseyHomeHeroResources`).

Also: publication eviction purges *documents and data*, not the image CDN transforms — the image
URL remains publicly fetchable after unpublish regardless. The marginal delta of rendering is
therefore exactly one thing: **pixels on screen for the few seconds until the stream resolves**,
after which React replaces the Suspense fallback with either the real `<Hero>` (same image, cache
hit, no flash) or `StoreNotPublished` (image disappears). The exposed artifact is a first-party
marketing image of a store that was public until seconds (worst realistic case: minutes) earlier,
with no copy, no price, no link — reachable only in the double-failure mode where the merchant was
already shown an eviction error. That is not materially worse than the current preload; it is the
same asset one step later in the pipeline.

**It would be materially worse** only if the shell rendered slide *copy* or PDP links — crawlable
anchors to an unpublished catalog in cached HTML is precisely the exposure the gate exists for.
Don't do that; see §4.

## 3. Domain reassignment (Q2)

No cross-tenant leak is possible from this change:

- The shell is pinned to the canonical tenant: `OGABASSEY_MERCHANT_SLUG = 'ogabassey'` constant in
  `ogabassey-home-hero-shell-data.ts`; the whole `(storefront)/ogabassey/` route group is
  tenant-hardcoded. The shell **never** reads request identity, so it can only ever emit
  OgaBassey's own hero — there is no input under another merchant's control.
- If ogabassey.com were ever remapped to merchant B while proxy still routed the host here, the
  *current* code already paints an OgaBassey-shaped, OgaBassey-branded skeleton and preloads
  OgaBassey's image on that host; adding the pixels changes nothing structural. The
  `shellMerchantId === merchant.id` binding (`ogabassey-home-page-content.tsx` lines 64–68) still
  guarantees merchant B's request never renders OgaBassey's shopping Hero, and the fallback gets
  replaced when the stream lands.
- Reassigning this apex is a platform-owner action, not merchant-controlled.

## 4. Achievability without `connection()` (Q3) — yes, and the boundary moves zero bytes

Put slide-0's image **inside the existing Suspense fallback**
(`ogabassey-publication-safe-hero-fallback.tsx`), which is already part of the static shell and
already consumes cached-derived data (`hasCarouselControls`). Concretely:

- Pass `slide0` (imageUrl only) from `ogabassey-static-home-page-content.tsx` into the fallback;
  render `MobileLcpHeroImage` (`mobile-lcp-hero-image.tsx`) inside the
  `HERO_MOBILE_PANEL_CLASSES` box with **`alt=""`** (the fallback is `aria-hidden` already),
  `imageFit="contain"`, `shouldPrioritizeImage`. Reusing the same component keeps
  srcset/sizes/quality parity with the preload, so the browser dedupes into one fetch — the bytes
  are typically already in flight (or done) by FCP.
- **Image only.** No `slide.name`, no `priceLabel`, no CTA text, no `<Link>`, no controls. The
  static-shell invariant narrows from "no product copy, images, links or controls" to "no product
  *copy, links or controls*" — update the comments at `ogabassey-static-home-page-content.tsx`
  lines 41–47/61–63 accordingly.
- `ogabassey-home-page-content.tsx` is **untouched** — `connection()`, `headers()`, tenant
  binding, `StoreNotPublished`, `notFound()` all stay exactly where they are. Nothing crosses the
  publication boundary; the fallback is replaced by the gated content exactly as today.
- PPR-resume hazard check: the #2479→#2637 hazard is request APIs in the shell path and rendered
  `<link>` nodes preceding the first critical-shell host node
  (`ogabassey-home-hero-resource-hints.ts` header note). A `<picture>` host node inside a
  Suspense fallback triggers neither. The 500 ms shell budget and null-degradation are unchanged
  (cold miss → no image, current behavior).
- LCP mechanics: since Chrome 88, removed/replaced elements remain valid LCP candidates, so the
  fallback paint at FCP *is* the recorded LCP even after the resume swap; the swapped-in Hero
  repaints the identical cached image (no flash, no reset).
- Desktop can get the same treatment in the `lg:col-span-3` box later; mobile is the field
  problem and should go first.

**Required test updates** (the contract is enforced):
`ogabassey-publication-safe-hero-fallback.test.tsx` line 27 asserts
`container.querySelector('a, button, img')` is absent — change to `'a, button'` and add positive
assertions: picture present, `alt=""`, **no anchor, no product-name/price text** in the fallback.
`ogabassey-static-home-page-content.test.tsx` likely needs the same invariant shift.

**Expected win:** throttled trace shows TBT 90 ms, FCP 4.1 s, LCP 9.0 s — the 4.9 s gap is purely
the dynamic-subtree stream. Painting the LCP element in the fallback collapses LCP to ≈ FCP:
roughly **9.0 s → ~4.1–4.5 s throttled**, recovering most of the ~36 % renderDelay subpart in
field data.

## 5. Recommendation

**(A) — render the cached hero image in the shell**, under these conditions:

1. Image-only in the `aria-hidden` fallback: empty alt, no copy, no links, no controls (§4).
2. Reuse `MobileLcpHeroImage` verbatim for preload/srcset parity.
3. Publication boundary and `shellMerchantId === merchant.id` binding byte-untouched.
4. Update the two contract tests to enforce the *new* invariant (no anchors/copy) rather than
   "no img".
5. No `cacheLife` tightening needed: the confirmed fail-loud foreground purge
   (`evictStorefrontPublicationCaches`) is the operative publication bound and already protects
   the shell and the dynamic gate identically; `revalidate: 60` remains a fine backstop. (If a
   belt-and-suspenders gesture is wanted, lowering `merchant.expire` from 3600 is the only knob
   worth touching, at some origin-load cost — not required.)

**Explicitly rejected alternatives:** (B) keeping the gate on the pixels defends against a
scenario — "shell stale-published while the live gate knows better" — that mostly cannot occur,
because the gate reads the same cache; when the window does exist (purge failure), the exposure is
a linkless first-party image whose bytes the current code already ships to every visitor. (C)
speeding the gated fetch (edge-caching `getRequestScopedMerchant`, etc.) cannot beat FCP-time
paint — the stream still costs a round trip plus resume on exactly the slow-network cohort that
dominates the field tail — and a different LCP element (styling the skeleton to be the LCP
candidate) games the metric without showing users anything sooner.

*Files read: ogabassey-static-home-page-content.tsx, ogabassey-home-hero-shell-data.ts,
ogabassey-home-page-content.tsx, ogabassey-publication-safe-hero-fallback.tsx (+ test),
ogabassey-home-hero-resource-hints.ts, ogabassey-home-launch-products.ts, lib/cached-data.ts,
next.config.ts (cacheLife), lib/cache-revalidation.ts, lib/storefront-publication-cache-eviction.ts,
lib/merchant-publication-data-cache-tags.ts, lib/storefront-publication-cache-tags.ts,
lib/storefront-merchant-snapshot.ts, api/merchant/publish/route.ts, Hero.tsx,
hero-mobile-carousel.tsx, mobile-lcp-hero-image.tsx, ogabassey-static-home-page.tsx.*
