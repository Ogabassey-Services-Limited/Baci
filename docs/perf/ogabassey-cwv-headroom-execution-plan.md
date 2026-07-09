# OgaBassey CWV Headroom — Execution Plan

**Rev 3 — 2026-07-07.** Rev 2 (reconstructed) upgraded after a 5-domain research validation against current primary sources (web.dev, developer.chrome.com, developers.cloudflare.com, nextjs.org, react.dev, posthog.com, webkit.org, caniuse — all fetched 2026-07-07). Every Rev 3 change below cites its source. Research run: workflow `wf_9db7f6f5-0ca` (5 researchers + synthesis).

Owner-approved direction: pursue OgaBassey Core Web Vitals improvements as narrow, review-looped PR batches with live verification after each merge. This plan is intentionally architectural: fix cache invalidation, delivery tier, image selection, static shell parity, JS/font weight, attribution side effects, and measurement correctness rather than adding isolated workarounds.

> Numbers below include the last known post-PR-2929 baseline from 2026-07-04. Refresh PSI, DebugBear, Chrome trace, and targeted curl probes before claiming any current result.

## Status ledger (Rev 3, 2026-07-07)

| Batch | Status |
| --- | --- |
| #2935 product CF purge | ✅ merged + live-verified (17 review rounds) |
| Ops-1 TTL raise (300→3600) | ✅ done (CF rule v10; header migration → Ops-2 below) |
| PR-MEASURE items 1–3 | ✅ shipped on main (queue in `web-vitals-queue.ts`, prerendering guard in `schedule-idle-boot.ts`, consolidated idle boot). Residuals re-scoped below |
| PR-IMG | ✅ merged (#2956) + full-catalog backfill (21,062 variants, 50% poisoned → ~0). Retroactive Vary exposure confirmed; PR-IMG-2a per-format URL fix is in this branch; PR-IMG-2b restores AVIF on PDP/cards/rails after client getImageProps validation. |
| PR-HOME | 🔄 #2969 landing (green; final CI). Post-merge canary + follow-ups below |
| Transformer incident fixes | ✅ merged (#2983, unplanned — fd-leak + timeout-crash from backfill incidents) |
| PR-MEASURE residuals | ✅ merged (#2992 + follow-up #2996, 2026-07-08) — pagehide beacon flush w/ per-payload origin context + full sanitize parity, LoAF attribution (source+invoker redacted, shape-aware), id/delta, in-memory identity fallback, capture_performance invariant |
| PR-WEIGHT | 🔴 next (large) |
| PR-ATTR | 🟠 PROMOTED (probe confirmed Set-Cookie stripping = live attribution loss) — NEXT, awaiting owner proxy.ts approval |
| Ops-2 (SWR headers + Early Hints) | 🔴 new in Rev 3 |
| SPEC-RULES (speculation prerender) | 🔴 backlog, preconditions listed |

## Goals

| Metric | Current / last known issue | Target |
| --- | --- | --- |
| Mobile LCP p75 | CrUX window previously ~4,729 ms; lab still poor on home/blog | ≤ 2,800 ms, stretch ≤ 2,500 ms |
| Mobile TTFB p75 | CrUX window previously ~1,984 ms | ≤ 1,000 ms — judge with CrUX RTT tri-bins (below) |
| Mobile FCP p75 | CrUX window previously ~4,346 ms | ≤ 2,500 ms |
| INP p75 | previously ~238 ms; home field showed ~405 ms | ≤ 200 ms |
| CLS | Home URL-level previously severe (0.37); #2969 lab shows 0.07 | ≤ 0.1 everywhere |

## Last known post-2929 baseline

Refresh this table before starting the next implementation batch.

| URL | Tool/profile | Last known result |
| --- | --- | --- |
| `https://ogabassey.com/` | PSI mobile | Perf ~75, LCP ~7.8s, CLS 0, TBT ~40ms |
| `https://ogabassey.com/` | DebugBear mobile SA | LCP ~6.6s, FCP ~1.5s, TBT ~945ms, CLS ~0.043 |
| `https://ogabassey.com/gaming-laptops/dell-alienware-m18-r3-rtx-5080` | PSI mobile | Perf ~88, LCP ~3.75s, CLS 0, TBT ~114ms |
| same canonical PDP | DebugBear mobile SA | LCP ~2.6s, FCP ~1.9s, TBT ~579ms, CLS 0 |
| `https://ogabassey.com/blog` | PSI mobile | Perf ~76, LCP ~7.3s, CLS 0, TBT ~90ms |
| `https://ogabassey.com/blog` | DebugBear mobile SA | LCP ~5.0s, FCP ~2.3s, TBT ~224ms, CLS 0 |
| Compare page sample | PSI/DebugBear mobile | Still slower than target; verify canonical URL before using |

## Non-negotiable measurement rules

1. Use canonical sitemap URLs for baseline and comparison unless explicitly measuring redirect overhead.
2. For every target URL capture cold and warm states separately: response headers (`cache-control`, `x-vercel-cache`, `cf-cache-status`, `set-cookie`), `time_starttransfer`, `time_total`, redirect count.
3. For LCP capture: LCP element selector/HTML summary, LCP request URL, request start time/duration/priority, LCP subparts.
4. For image changes capture: final selected candidate URL, `content-type`, transfer size, rendered vs intrinsic dimensions.
5. For JS/font changes capture: total JS transfer + execution, render-blocking requests, unused JS/CSS, font timing + swap/layout shift.
6. Never claim a CWV win without post-deploy PSI + DebugBear + targeted browser/curl proof.
7. CrUX is a 28-day field window. Use it for final trend validation, not immediate PR verdicts.
8. **(Rev 3)** Judge the TTFB target with **CrUX RTT tri-bins** (CrUX API, Jan 2025): for a Nigeria-heavy audience, p75 TTFB is partly network floor no origin work can remove — prevents chasing an unreachable target post-Ops-1/2. *(CrUX release notes 2025-02-11.)*
9. **(Rev 3)** **Segment field LCP by browser engine.** Safari 26.x now reports LCP, so PostHog field LCP includes ~12.7% Safari sessions while CrUX stays Chrome-only; a population shift mid-campaign can masquerade as regression/improvement. *(DebugBear LCP browser-support docs.)*
10. **(Rev 3)** Two Chromium **LCP-element identity heuristics** can silently invalidate before/after comparisons: images below ~0.05 bits/displayed-pixel are EXCLUDED from LCP (Chrome 112+) — keep low-quality variants comfortably above that (may explain navbar-as-LCP observations); full-viewport elements are excluded as background — the mobile slide-0 hero must not fill the entire viewport or it can never be the LCP candidate. Re-verify LCP element identity after every image-quality or hero change. *(chromium metrics_changelog 2023_04_lcp.md; web.dev/articles/lcp upd. 2025-09-04.)*

## Execution order (Rev 3)

```text
PR-HOME #2969 merge + production canary
  -> ATTR-PROBE (ops probe, no code — may promote PR-ATTR)
  -> PR-MEASURE residuals (small)
  -> PR-WEIGHT (large; INP diagnose leg rides on MEASURE attribution)
  -> PR-ATTR (position set by ATTR-PROBE result)
  -> Ops-2 (CDN-Cache-Control split + SWR + Early Hints toggle)
  -> SPEC-RULES backlog (preconditions: MEASURE guard + ATTR prerender gate live)
```

Reasoning updates vs Rev 2: (a) research shows the PR-ATTR premise is inverted — Cloudflare likely **strips** the attribution Set-Cookie on cached responses rather than blocking fill, i.e. a live revenue-attribution bug, so ATTR-PROBE runs immediately and may promote PR-ATTR ahead of PR-WEIGHT; (b) the INP work in PR-WEIGHT depends on LoAF attribution data from PR-MEASURE, so MEASURE stays first among the code batches.

## ATTR-PROBE — 30-minute ops probe before locking sequence *(new in Rev 3)*

Cloudflare's documented behavior for cacheable responses carrying `Set-Cookie` under a cache rule with an explicit Edge TTL override (exactly the Ops-1 config): **"Cloudflare removes the Set-Cookie and the asset is cached."** That inverts Rev 2's premise — ad-landing pages likely DO fill the edge cache, but users may never receive `baci_gclid`/`baci_fbclid` (active attribution loss). *(developers.cloudflare.com/cache/concepts/cache-behavior/.)*

Probe both legs on production:

1. Cold + warm `?gclid=X` landing: `cf-cache-status` MISS→HIT?
2. On BOTH MISS and HIT: does the browser response actually carry the attribution `Set-Cookie`?

Decision: if cookies are confirmed stripped, **promote PR-ATTR to run immediately after PR-MEASURE residuals** — sequencing it last extends a live attribution bug for the whole campaign. If cookies survive (rule config differs from docs), keep PR-ATTR last as planned.

**PROBE RESULT (2026-07-08): CONFIRMED STRIPPED.** Sole-click-ID landings (`?gclid=`, `?fbclid=`, any value) return `cf-cache-status: HIT` with ZERO `baci_*` Set-Cookie — the normalization shares one warm entry across all gclids (good for LCP) but Cloudflare strips the attribution cookie on every cached response. Mixed-query landings (`?gclid=&utm_source=`) go DYNAMIC and DO receive `baci_gclid` — proving the middleware works and only the cached path loses it. **PR-ATTR is hereby promoted: runs immediately after PR-MEASURE residuals.** Requires owner approval for the proxy.ts minimal diff before implementation.

## PR-MEASURE — make field data trustworthy *(re-scoped in Rev 3)*

### Shipped on main (do not re-implement)

- Web-vitals queue-and-flush before PostHog boot, cap 10 — `apps/web/src/lib/posthog/web-vitals-queue.ts`.
- `document.prerendering` + `prerenderingchange` guard — `apps/web/src/lib/posthog/schedule-idle-boot.ts`.
- Consolidated idle boot — `instrumentation-client.ts`.

Two Rev 2 premises corrected: (a) web-vitals uses **buffered PerformanceObservers**, so late registration still recovers TTFB/FCP/LCP — the real loss is sessions that END before the ≤4s idle boot; (b) Cloudflare Speed Brain is **prefetch-only** (no JS execution) — the prerendering guard is a prerequisite for future self-managed Speculation Rules, not a Speed Brain mitigation. *(web-vitals README; developers.cloudflare.com Speed Brain docs.)*

### Remaining changes

1. **Page-hide flush via sendBeacon, without booting posthog-js.** Flush the queued vitals on `visibilitychange→hidden` (plus `pagehide` for Safari) via `navigator.sendBeacon` directly to the first-party `/ingest` capture path. Today the queue's only flush trigger is PostHog init, so every bounce-before-boot session — disproportionately the slow-TTFB/LCP cohort this campaign targets — is silently dropped: survivorship bias that makes "corrected" field data read optimistically. *(web.dev/articles/vitals-field-measurement-best-practices: "once the page's visibility state changes to hidden there's no guarantee that any script… will run again".)*
2. **Attribution build as the reporting mechanism.** Import from `web-vitals/attribution` (v5); retain `target`, LCP subparts, `largestShiftTarget`, and INP LoAF fields (longest script + buckets) in the flat `web_vitals` event (~1.5KB brotli). Without attribution payloads the step-4 hypothesis re-checks cannot identify WHICH element was LCP or which node shifted. *(web-vitals v5 CHANGELOG — INP+LoAF attribution; LoAF stable since Chrome 123.)*
3. **Health-check with a boot-independent denominator.** Both `web_vitals` and `$pageview` queue behind the same idle boot, so bounce-before-boot sessions vanish from BOTH sides and a ratio check validates the bias instead of detecting it. Anchor the denominator to edge HTML request counts (Cloudflare/Vercel analytics); count the custom flat `web_vitals` event, not `$web_vitals`. **Invariant (add test + rationale): `capture_performance: false` stays false** — PostHog's built-in web-vitals autocapture lacks TTFB and has no page-hide flush; re-enabling it creates duplicate conflicting pipelines. *(posthog-js dist inspection; posthog.com/docs/web-analytics/web-vitals.)*
4. After one week of corrected field data, re-check: navbar-as-LCP hypothesis (see measurement rule 10), home field CLS contributors, FCP-later tradeoff after font/image changes.

### Acceptance gate

- Unit tests prove pre-boot vitals are queued and flushed exactly once, INCLUDING the page-hide path (sendBeacon called, no posthog-js boot).
- Prerendered pages do not send pageview/web-vitals until activation.
- No duplicate PostHog boot/pageview on direct load or SPA navigation.
- Live capture ratio vs EDGE request counts improves after deploy.

### Post-deploy watch (2026-07-08 verification)

`pagehide_beacon` events: **0 arrived** in the first ~2h post-deploy, but transport is proven healthy (sibling blog beacon on the SAME shared helpers delivered 218 events post-deploy) and the deploy is confirmed live (git_commit_sha on incoming events == #2996's squash). Architecture limits firing to the narrow pre-boot window (metric queued + tab hidden within ≤4s idle-boot ceiling). **Re-check in 12–24h**; if still zero with material traffic, investigate `hasPostHogBrowserInitialized()` flipping true before init completes (would make the queue permanently empty → beacon structurally dead).

### Watch item (no action this campaign)

Soft Navigations API: Chrome ~151 (~H2 2026) targets unflagged per-soft-nav vitals entries. Keep the flat `web_vitals` schema extensible (future `navigationId` dimension). *(developer.chrome.com final-soft-navigations-origin-trial, Apr 2026.)*

## PR-IMG — image delivery and variant correctness *(shipped; one retroactive precondition)*

Shipped as #2956 + full-catalog backfill. Retained acceptance evidence: sampled hero/blog/PDP URLs AVIF under AVIF Accept; 98.5% healthy; residual non-AVIF = home-hero q70 surface (PR-HOME's preload warms it organically).

### Follow-up discovered in Rev 3 research — Vary for Images precondition

By default **Cloudflare stores ONE body per URL and ignores `Vary`**, so an AVIF-prewarmed URL serves AVIF bytes to EVERY client — including non-AVIF browsers. AVIF global support is ~93.4%; the gap includes Opera Mini (inside Nigeria's ~19.7% Opera share), iOS ≤16.0, Edge <121. Rev 2's "prewarm AVIF, never pin AVIF" is **not achievable at the edge without one of**:

- enable **Vary for Images** (API-only, Pro+ plan; origin must emit `Vary: Accept`; file extension must be in the URL path, not the query string), or
- move to per-format URLs (e.g. explicit format in the path) so each format has its own cache key.

Action: probe a WARM cache entry with an Opera-Mini/iOS-15 Accept header. If it returns AVIF to a non-AVIF Accept, schedule the fix (likely per-format URLs, since the transformer owns URL shape) as a small follow-up PR + re-warm. *(developers.cloudflare.com/cache/advanced-configuration/vary-for-images/; caniuse AVIF.)*

**PROBE RESULT (2026-07-08): EXPOSURE CONFIRMED.** Warm product URL (`width=750,quality=35,format=auto/...dell-xps-14...png`) served the SAME cached AVIF bytes (identical etag/content-length, cf HIT) to AVIF, webp-only, and `*/*` iOS-15/Opera-Mini Accepts — non-AVIF clients receive undecodable bytes off `max-age=31536000, immutable` entries. Blog hero (no width/quality segment) is locked to JPEG for everyone (inverse case). Origin emits `Vary: Accept` correctly; CF Free-plan edge ignores it (Vary-for-Images is not available). **Fix in flight: PR-IMG-2a per-format URLs** — the `<picture>` element already does client-side format selection via `<source type>`, so browser-facing fallbacks emit explicit `format=jpeg|png`; home hero emits an explicit `format=avif` `<source>` plus fallback; broader AVIF restoration is deferred to PR-IMG-2b. Poisoned `format=auto` entries must be purged/re-warmed after merge.

### PR-IMG-2a / PR-IMG-2b split

PR-IMG-2a, this branch, ships the correctness fix first:

- all OgaBassey CDN loader fallbacks use explicit `format=jpeg` or `format=png` instead of browser-facing `format=auto`;
- blog inline image variants use explicit fallback formats;
- home mobile and desktop hero pictures include AVIF `<source>` candidates and the home hero preload follows the AVIF tier when a full AVIF twin exists;
- shared `CdnFormatImage` and `ogabassey-image-format-sources` helpers are introduced and tested, but broad product-card/PDP wiring is deferred.

PR-IMG-2b restores AVIF on PDP gallery images and product cards/rails after validating the client `getImageProps` path. Until then, only the PR-IMG-2a migrated surfaces (home hero, blog inline images, and PDP main/LCP image paths) are cache-safe explicit-format fallbacks; product-card, rail, gallery-thumbnail, and remaining global-loader surfaces still use `format=auto` and must not be treated as safe until PR-IMG-2b lands.

Post-merge requirement: purge poisoned browser-facing `format=auto` entries and re-warm the explicit-format URLs.


### Non-goal (Rev 3)

**JPEG XL stays out of the format ladder** until Chrome ships it default-on (145 is flag-only; expected H2 2026). Revisit ladder + cache keys then.

## PR-HOME — static first-slide shell and CLS/LCP fix *(#2969 landing; canary + follow-ups)*

Shipped in #2969: server-only non-hydrated slide-0 in the PPR shell fallback with structural geometry parity (shared `hero-mobile-geometry.ts`, parity tests), 500ms-budgeted cached lookup failing open to the baked banner, media-scoped hero preload, ₦ font subset (1.2KB, kills the 86KB latin-ext fetch), grid-scoped interaction activation, lazy mock catalog. `connection()`/`headers()` untouched. Local prod-mode gate: CLS 0.07 (vs 0.37 field), zero hydration errors at 6× throttle, fallback + preloads verified in first-flush HTML.

### Production canary (immediately post-merge) — Rev 3-hardened checklist

1. LCP element identity: real slide-0 `<img>` (or its text column) — NOT navbar/search chrome. Mind measurement rule 10 (entropy + full-viewport exclusions).
2. Zero React hydration errors (#418/#419/#423/#425) under 6× CPU throttle, browser + bot UA.
3. CLS ≤ 0.1.
4. **Preload discipline** *(updated guidance)*: current web.dev + Next 16 guidance is **fetchpriority-first** — since the hero `<img>` is IN the first-flush HTML (preload-scanner discoverable), `fetchPriority="high"` + eager loading on the img is the primary mechanism; head preload is only for images NOT in the initial HTML. #2969 renders `fetchPriority="high"` AND emits a `preload()`. Verify: preload URL == LCP request URL, **zero duplicate hero fetches**, no "preloaded but unused" console warning, and the emitted `<link rel=preload>` actually carries the `media` attribute (react-dom `preload()` does not document `media` — if dropped, desktop fetches the mobile hero wastefully). If any check fails, drop the preload leg — the in-HTML img + fetchpriority carries it. *(web.dev/articles/preload-responsive-images upd. 2025-12-03; nextjs.org image docs v16.2.10; react.dev/reference/react-dom/preload.)*
5. Naira subset live: `inter_naira` preloaded; the 86KB latin-ext slice never requested; ₦ renders.
6. **bfcache eligibility** *(new)*: DevTools Application → Back/forward cache on home + a PDP — no unload/beforeunload listeners, no lingering WebSockets/Supabase realtime on storefront pages. bfcache restores count as near-instant page visits in CrUX and directly move field LCP/CLS on home↔PDP loops. *(web.dev/articles/bfcache upd. 2026-07-02.)*

### Follow-ups (small PRs, post-canary)

1. **Home-hero purge wiring.** With edge TTL 3600, hero/campaign changes need cacheTag revalidation AND a Cloudflare purge of `/` — #2935's purge chain covers product/listing URLs, NOT home-hero-affecting mutations that bypass product rows (pin-config, merchant branding). Wire hero-affecting mutations → purge(`/`), or explicitly document up-to-1h staleness as accepted.
2. **Shell durability check.** Confirm the hero shell data path stays on durable cache (`'use cache: remote'` legs) — default `'use cache'` is in-memory and may re-evaluate per serverless invocation; cold Vercel instances would then pay the lookup on TTFB (the 500ms budget bounds this; durable cache removes it). *(nextjs.org/docs/app/getting-started/caching v16.2.10.)*
3. **Consider `unstable_instant` + `@next/playwright` `instant()`** for build-time proof the home route yields an instant static shell containing the real hero — automates the canary's central question in CI. *(nextjs.org/docs/app/guides/instant-navigation.)*
4. **(Design note)** Next docs' preferred shape is real content OUTSIDE the Suspense boundary rather than enriched fallbacks. #2969's fallback-parity approach was validated empirically (pixel-identical swap, CLS 0.07); revisit hoisting only if field data shows swap artifacts.

### Acceptance gate

- DebugBear home mobile LCP materially improves; PSI home LCP or its load-delay subpart shrinks materially.
- Home CLS ≤0.1 lab, trending down in field after the CrUX window catches up.

## PR-WEIGHT — reduce JS, font, and HTML weight + fix INP *(rewritten in Rev 3)*

### Problem

Remaining mobile LCP/FCP/INP headroom is bounded by client bundle size, font request priority, HTML/Flight payload weight — and home INP p75 regressed (~238→405ms) with lab TBT disagreement (DebugBear ~945ms vs PSI ~40ms), implicating session-replay/hydration as much as bundle size.

### Changes

1. **INP: diagnose-then-fix** *(new, first)*. (a) Land field LoAF script attribution first (rides PR-MEASURE change 2); identify the actual long-frame scripts on home (candidates: rrweb/session replay, hydration bursts, ad boot). (b) Then apply `scheduler.yield()` with feature-detect + `setTimeout` fallback inside the identified heavy handlers — Chrome/Edge 129+, Firefox 142+, NOT Safari (not Baseline). Without the diagnosis leg, a null INP result is uninterpretable. *(web.dev/articles/optimize-inp upd. 2025-09-02; caniuse scheduler.yield.)*
2. **sanitize-html: convert consumers to RSC, don't relocate bytes into Flight.** Passing large sanitized HTML strings as props to `'use client'` components double-encodes them (HTML + serialized Flight props). Convert the consuming pages (privacy/terms/about/faq, category-hub-sections, blog renderer) so `SafeHtml` renders in Server Components with only leaf-interactive parts client. Keep server-side sanitization for API-route importers (sanitizer boundary unchanged). Once server-only, add `sanitize-html` to `serverExternalPackages` (jspdf/sharp precedent in next.config.ts). *(Vercel react-best-practices; repo import graph of `src/lib/sanitize.ts`.)*
3. **Prefetch: hover-prefetch middle path; `prefetch={false}` is transitional.** On the App Router `prefetch={false}` also disables hover prefetch, and PDPs are dynamic routes — clicks then wait a full server render against ~1–2s field TTFB. Use the documented `prefetch={active ? null : false}` onMouseEnter pattern for blog→PDP related-product links; gate on click-to-navigation latency, not just prefetch counts. Mark transitional: Next 16.3 Partial Prefetching (repo already runs `cacheComponents: true`) is the durable fix — revisit at the 16.3 upgrade, where blanket `prefetch={false}` becomes counterproductive. *(nextjs.org/docs/app/guides/prefetching upd. 2026-06-23; nextjs.org/blog/next-16-3-instant-navigations.)*
4. **JSON-LD: Organization-level policy markup FIRST, then strip per-offer duplicates.** Declare `hasMerchantReturnPolicy` + `hasShippingService` once under Organization (homepage markup); keep per-product overrides only where policies differ; keep `@id` refs for within-page ProductGroup/variant linking. Strictly larger HTML cut than @id-refs alone (seo-utils.ts repeats both objects per offer AND per variant offer) and it is Google's documented pattern. **Hard sequencing:** org markup live → verify Search Console Merchant-listings report → THEN remove per-offer blocks (stripping first can silently degrade merchant-listing annotations while Rich Results Test still passes). *(developers.google.com/search/docs/appearance/structured-data/organization upd. 2026-04-15.)*
5. **Fonts: per-font strategy, not a generic preload demotion.** `display:optional` only renders the font if it arrives within ~100ms — it effectively REQUIRES preload; demoting preload AND flipping to optional together means cold mobile visits never see the font. Pairs: **naira subset = optional + preload (shipped, correct)**; **Inter = swap WITHOUT preload** (accept one swap; next/font's default `adjustFontFallback` already provides the metric-compatible fallback — free), or subset Inter further. **Verify the "second large font" premise against a live trace first** — unconfirmed in the current tree. Emit `Link` response headers for the final font choice to ride Early Hints (Ops-2). *(web.dev/articles/font-best-practices; Next.js Font API v16.2.10.)*
6. **Home JS trim residue** (post-#2969): the dual-card swap elimination (grid renders one card implementation instead of the static+interactive pair) — split-out follow-up per #2969 review; plus optional React 19.2 toolkit: `<Activity mode="hidden">` for offscreen carousel slides/drawers (don't SSR-hide SEO-critical nav), React Performance Tracks for interaction-time renders, and a Flight-prop audit (pass ids/fields, not whole product rows). *(react.dev Activity docs; Vercel react-best-practices.)*

### Acceptance gate

- Client JS transfer/execution reduces on home/blog/PDP.
- Field INP long-frame attribution identifies the top scripts before and shows movement after.
- Font changes do not worsen CLS or brand rendering (trace-verified).
- Rich Results validation AND Search Console merchant-listings remain intact through the JSON-LD sequencing.
- Click-to-navigation latency on related-product links does not regress.

## PR-ATTR — attribution cookies off cacheable documents *(premise inverted in Rev 3)*

### Problem (corrected)

Rev 2 assumed the middleware `Set-Cookie` blocks shared-edge fill. Cloudflare's documented behavior under an Edge-TTL-override cache rule is the opposite: **it strips Set-Cookie and caches anyway** — meaning ad-landing users on cache HITs (and possibly MISSes, per rule config) never receive `baci_gclid`/`baci_fbclid`: an **active attribution loss**, not a caching loss. ATTR-PROBE (above) confirms which world we're in and sets this batch's position. *(developers.cloudflare.com/cache/concepts/cache-behavior/.)*

### Change (upgraded)

Move ad-click capture client-side — but **set the cookie via HTTP, not `document.cookie`**:

- tiny early inline script (in head, NOT behind hydration or the deferred PostHog boot — fast-bounce conversions must not lose attribution) reads `location.search`
- sends click IDs via `fetch`/`sendBeacon` to a small first-party endpoint (e.g. `/api/attr`) whose **response carries the 90-day Set-Cookie**
- rationale: pure JS-written cookies are capped by Safari ITP to **24 hours on link-decorated landings** (exactly the gclid/fbclid case; 7 days otherwise) — the Rev 2 design guaranteed a Safari attribution regression. Same-domain server-set cookies are not capped. *(webkit.org/tracking-prevention/; 90-day window in `apps/web/src/lib/ad-tracking-cookies.ts:41`.)*
- **prerender-gate the script** with the same `document.prerendering`/`prerenderingchange` check as PostHog — prerendered pages execute JS; un-activated prerenders would mint junk attribution cookies, and cookie writes can evict bfcache entries. *(developer.chrome.com/docs/web-platform/prerender-pages.)*
- remove the storefront-document `Set-Cookie` leg from `proxy.ts` (minimal diff; protected file)

### Guardrails

- `proxy.ts` is protected: minimal diff only, explicit PR body note, full proxy tests.
- No payment/order attribution regression; existing client-side order attribution reads the same cookies.
- Cookie attributes unchanged (Secure, SameSite, 90-day).
- Post-deploy, cookie-set rates will SHIFT because bots stop minting server-set cookies — don't misread as regression.

### Acceptance gate

- Cold `?gclid=` landing fills cache MISS→HIT **and** the browser holds the attribution cookie after BOTH MISS and HIT landings.
- **Cache-key normalization probes**: `?gclid=X&utm_source=Y` mixed queries plus fbclid/ttclid/msclkid all normalize to a HIT-able key (every gclid is unique — without sole-click-ID normalization, ad-landing HIT-rate stays ~zero); purges use the end-user (non-transformed) URL form. *(CF purge-by-single-file transform caveat.)*
- Safari (ITP) attribution window verified ≥ intended duration via the server-set cookie.
- Order creation still receives attribution IDs.

## Ops-2 — edge freshness in code + Early Hints *(new in Rev 3)*

1. **Replace dashboard-TTL reliance with layered response headers.** Vercel strips `s-maxage` before forwarding — Cloudflare currently caches only because of the dashboard rule. Emit `Vercel-CDN-Cache-Control: max-age=300` (Vercel layer) + `CDN-Cache-Control: max-age=3600, stale-while-revalidate=86400, stale-if-error=86400` (Cloudflare layer). SWR converts the post-expiry synchronous origin round-trip (Vercel cold start + RSC render — a direct contributor to the ~1,984ms TTFB p75) into an instant stale serve + background revalidate; purge-on-mutation (#2935) bounds staleness. Caveats: the CF-visible header must NOT contain `s-maxage` or `must-revalidate` (each disables SWR/stale-if-error); pick ONE source of truth — cache-rule TTL actions override origin `CDN-Cache-Control` and make curl probes misleading, so retire the dashboard TTL when the headers land. Note: `storefront-cache.ts` + `proxy.ts` are protected surfaces — owner approval required. *(vercel.com/docs/caching/cache-control-headers 2026-07-01; developers.cloudflare.com/cache/concepts/cdn-cache-control/.)*
2. **Enable Cloudflare 103 Early Hints** (free toggle, Speed → Content Optimization) and emit origin `Link` headers for: the chosen font woff2 (single fixed URL — pairs with PR-WEIGHT change 5) and `preconnect` to the image CDN host. Cloudflare replays these as 103 before the origin responds — ideal fit: CF-fronted, large origin think-time to hide, Nigeria mobile ~64.5% Chrome (honors 103 preload+preconnect). Scope limits: responsive `imagesrcset` preloads are NOT supported in header/103 form (hero stays out); CF sends no 103 on cache HITs — value concentrates on MISS/dynamic paths, exactly where TTFB pain lives. Vercel's lack of native 103 is irrelevant (origin only emits `Link`). *(developers.cloudflare.com/cache/advanced-configuration/early-hints/; web.dev/articles/preload-responsive-images.)*

### Acceptance gate

- Header split visible at both layers; CF TTL honored from the header; dashboard rule retired.
- Post-expiry request serves stale instantly (`cf-cache-status: STALE`/`UPDATING`) with background revalidation observed.
- 103 responses observed on cold HTML fetches carrying the font/preconnect hints; no double-fetch of fonts.

## SPEC-RULES — self-managed Speculation Rules prerender *(named backlog batch, new in Rev 3)*

Document-rule prerender at moderate eagerness for top home→category/PDP links is the strongest remaining navigation-LCP lever (published PLP→PDP case study: mobile LCP 4.69s→2.66s). Layers safely over Speed Brain (CF won't override origin rules).

Preconditions (hard): PR-MEASURE's prerendering guard live (shipped) AND PR-ATTR's prerender gate live. Exclusions: cart/checkout/auth/state-changing URLs. *(developer.chrome.com prerender-pages, 2026 eagerness semantics.)*

## Non-goals / watch items (Rev 3)

- **View Transitions**: perceived-perf only — they add work inside INP's presentation-delay window with no measurement exclusion through 2026; never adopt as a "free" CWV win. *(chromium INP changelog.)*
- **JPEG XL**: out of the CDN ladder until Chrome ships default-on (145 flag-only; ~H2 2026).
- **PostHog `capture_performance` autocapture**: stays OFF (see PR-MEASURE invariant).
- **Soft Navigations**: schema watch item only (PR-MEASURE).

## Verification protocol for every PR

1. Use an isolated worktree from current `origin/main`.
2. Keep each PR narrow and file-surface-specific.
3. Run relevant local tests first, then quality gates (`pnpm turbo lint`, `pnpm turbo typecheck`, targeted tests, full tests where practical).
4. Request and process `@claude review` and `@codex review` (+ CodeRabbit).
5. Fix only verified findings. Resolve only conversations addressed by code.
6. Merge only after checks and review threads are clean.
7. Wait for production deployment; then remeasure (PSI, DebugBear, trace, curl probes).
8. Update this plan + the memory record with before/after values.

## Canonical test URLs

Refresh from sitemap before use.

- Home: `https://ogabassey.com/`
- Blog listing: `https://ogabassey.com/blog`
- Canonical PDP sample: `https://ogabassey.com/gaming-laptops/dell-alienware-m18-r3-rtx-5080`
- Additional PDP samples: `https://ogabassey.com/smartphones/honor-x9d-256gb-12gb`, `https://ogabassey.com/smartphones/samsung-galaxy-a36-5g`, `https://ogabassey.com/tablets/redmi-pad-2-pro`
- Compare page: pick one live canonical compare URL from sitemap.

## Risk register

| Risk | Mitigation |
| --- | --- |
| AVIF served to non-AVIF browsers from single-body CF cache | Vary-for-Images or per-format URLs precondition (PR-IMG follow-up); warm-cache Opera-Mini/iOS-15 probe |
| Safari ITP caps JS-set attribution cookies at 24h | HTTP-set cookie via `/api/attr` endpoint (PR-ATTR) |
| Survivorship bias in "corrected" field data | sendBeacon page-hide flush + edge-anchored health-check denominator (PR-MEASURE) |
| JSON-LD dedupe damages merchant listings | Organization-markup-first sequencing + Search Console verification before stripping |
| `proxy.ts`/`storefront-cache.ts` changes break security/cache/auth | owner-approved minimal diff, full proxy tests, live probes |
| Home static shell hydration/resume mismatch | production canary, bot/browser UAs, React 418/419 console check |
| SWR serves stale after mutations | purge-on-mutation (#2935) + home purge wiring (PR-HOME follow-up 1) |
| Prerender mints junk analytics/attribution | prerendering guards in both pipelines (shipped + PR-ATTR) |
| Lab-only improvement hurts real UX | visual check + field follow-up before declaring success |
| Dirty root checkout misleads agents | clean isolated worktrees from `origin/main` |

## Definition of done

1. Home, PDP, blog, and compare pages have no obvious remaining low-risk LCP/CLS/INP fixes.
2. Mobile lab LCP materially improved across the worst pages.
3. Field data collection reliable (including the bounce-before-boot cohort) to validate trend movement.
4. No React hydration errors, invalid resource hints, broken images, or SEO/schema regressions.
5. Final report includes before/after PSI, DebugBear, and targeted probe evidence; CrUX 28-day window confirms field movement (~2026-08).
