# OgaBassey Home Route — JS / Byte Budget Cut-List

**Date:** 2026-07-23
**Author:** investigation (read-only; no source changed, no PR opened)
**Field finding under investigation:** Home LCP p75 flat ~4.7 s post-2026-07-13 despite all image/prewarm/pattern fixes. Segmentation isolates the tail to **Android + Chrome, Nigeria** (Android p75 5320 ms vs iOS 2342 ms on the *identical* hero images). Because the images are identical and iOS is fine, the residual is **CPU (JS parse/execute) + network before first paint — not image bytes.** Lever: cut eager client JS / critical-path payload the home ships before LCP. Prior wins of this exact shape: #3046 (posthog off the eager error-boundary graph), #3022 (home flight-payload slim).

---

## TL;DR (read this first)

**The ogabassey home boot path is already heavily optimized. There is no large eager library left to remove.** Every heavy dependency in the build — `@supabase/*` (74.7 KB), `@tiptap`+`prosemirror` (130 KB), `@puckeditor`+`@dnd-kit` (113 KB), `country-flag-icons` (49.8 KB), `libphonenumber-js` (46.6 KB), `framer-motion`/`motion` (76.5 KB), `fuse.js` (17 KB) — is **route-split or deferred off the home entry** (verified by import-graph tracing, see §5). `posthog-js` (73.3 KB) and Vercel analytics are already dynamic-imported (#3046). Ad units, the cart sidebar, the footer/overlay chrome, the utility modal and the mobile menu are all behind `lazy()`/`dynamic()` boundaries. Pixel scripts already use `strategy="lazyOnload"`.

Consequently the remaining eager home JS is **the React framework floor (~63 KB react-dom + scheduler + Next client runtime) + polyfills (39 KB, not downloaded by modern Chrome) + ~60–70 KB of small, mostly-necessary app code** (nav, cart badge, hero, providers). The slow-Android tail is therefore most likely dominated by **framework hydration cost on slow CPUs + network/TTFB**, with only incremental JS left to shave.

The three worthwhile JS levers are all **lazy-hydration / deferral of non-LCP islands** (they remove main-thread *work* in the LCP window, which matters disproportionately on slow Android CPUs even when the KB is small), plus one higher-risk polyfill option. Details in §6–§7.

---

## 1. Method & what "the home route" actually is

`ogabassey.com/` is **not** the platform `app/page.tsx`. It is a custom-domain storefront rewritten (via `proxy.ts`) onto the `(storefront)/[slug]/(home)/page.tsx` route, which detects the ogabassey identifier and renders a dedicated static home:

```
[slug]/(home)/page.tsx                     (server; picks ogabassey branch)
  └─ ogabassey-static-home-page.tsx        (server)
       ├─ OgabasseyStaticResourceHints     (server)
       └─ OgabasseyStaticHomePageContent   (server; hero shell + <Suspense>)
            ├─ OgabasseyHomeStyleLoader
            └─ OgabasseyHomePageContent     (server; publication guard)
                 ├─ Hero  ────────────────  slides[0] img = LCP element
                 │    ├─ HeroMobileCarousel      ● 'use client'  (mobile cohort)
                 │    ├─ HeroDesktopGrid          server-only (no 'use client')
                 │    └─ HeroUtilityPanel   ● 'use client' (defers UtilityModal)
                 └─ <Suspense> OgabasseyHomeDynamicContent (server)
                      ├─ AnalyticsPixelProvider  ● 'use client'
                      └─ OgabasseyHomePage
                           ├─ DeferredAdUnit      (deferred)
                           └─ HomeProductGrid ● 'use client' (useDeferredActivation)
```
Layout chain wrapping it (`[slug]/layout.tsx`): `StorefrontMerchantProvider` (SSR-data only, **no supabase**) → `StorefrontCartProvider` → `OgabasseyStorefrontLayout` → `StorefrontShellLayout` (`OgabasseyLayoutProviders` + eager `Navbar` + eager `MobileFooter`; **footer/overlay chrome are `lazy()`**). Root `layout.tsx` adds eager `Toaster` + a `<Suspense>`-wrapped `RootDynamicBody` (posthog/vercel — all deferred).

**Measurement source.** A production bundle-analyzer build **succeeded** (`next experimental-analyze --output`, 51 s; env `npm_config_verify_deps_before_run=false PUPPETEER_SKIP_DOWNLOAD=true`). It emitted a real per-module graph at `.next/diagnostics/analyze/data/[slug]/analyze.data` with **per-module compressed byte contributions to each client chunk** (`chunk_parts[].compressed_size`). All KB figures below are **real compressed bytes from that build** unless labelled otherwise. See §8 for the one measurement gap.

---

## 2. Eager home client-JS budget (real compressed sizes)

App-code modules confirmed on the home eager path (client chunks, gzip-class compressed):

| Group | Modules | ~KB (comp) |
|---|---|---:|
| Hero + carousel island | Hero, hero-mobile-carousel, hero-desktop-grid, hero-utility-panel, GadgetPattern, carousel-play/progress, launch-slides | **~13** |
| Navbar chrome (eager) | navbar, navbar-search, navbar-notifications, navbar-category-dropdown, navbar-secondary-nav, storefront-layout-chrome, MobileFooter | **~17** |
| Providers | StorefrontMerchantProvider (SSR-only 2.4), StorefrontCartProvider 2.65, use-cart 3.75, cart/* 4.52, theme 2.1, ogabassey/providers 2.39 | **~18** |
| Analytics wrappers (eager) | lib/analytics 5.99, lib/event-tracking 3.09, pixel wrappers (GA/FB/TT/Snap/Tw) ~3.6, analytics-pixel-provider 0.64, consent-mode 0.59 | **~14** |
| Product grid | HomeProductGrid 3.6, HomeProductGridCard 1.53, ProductGridInteractionBindings 0.81 | **~6** |
| Root/shell misc | Toaster+toast 2.6, ad-attribution-capture, speculation-rules, zustand 1.41, scroll-visibility 0.43, deferred-shell-feature 1.02 | **~8** |
| **App-code eager subtotal** | | **~76** |
| Framework floor | `next/…/react-dom` 63.0, scheduler, segment-cache, react-server-dom runtime, get-img-props 7.6, ua-parser 7.3 | **~85** |
| Polyfill (nomodule) | `polyfill-nomodule.js` — **not fetched by modern Chrome** | 39.4 |

Deferred / off-entry (loads **after** LCP in separate chunks, listed to prove they are *not* levers): `posthog-js` 73.3, `@supabase/*` 74.7 (auth-js 30.2 + realtime-js 12.1 + phoenix 8.0 + storage 6.7 + postgrest 5.4 + ssr 6.5), Vercel analytics/speed-insights, cart sidebar, negotiation modal, utility modal, mobile menu, google-store-widget.

---

## 3. Already done — do NOT re-propose

| Optimization | Evidence |
|---|---|
| **#3046** posthog-js off eager graph (dynamic import) | `posthog-client-bootstrap.tsx` → `await import('@/lib/posthog/browser')`; `deferred-platform-insights.tsx` dynamic-imports `@vercel/analytics` + speed-insights |
| **#3022** home flight-payload slim + empty-rating-star hide | commit `cfd2618a96` |
| **#3048** home-hero q70 tier prewarm (image, not JS) | commit `fa2cc988c3` |
| Pixel scripts deferred to idle | `google-analytics.tsx` / `facebook-pixel.tsx` `<Script strategy="lazyOnload">` |
| Ad units deferred | `DeferredAdUnit` (`activateOnInteraction`, `bootDelayMs`) |
| Cart sidebar / footer / overlay chrome deferred | `storefront-layout-chrome.tsx` `lazy(() => import('./storefront-deferred-footer-chrome'))` + overlay; `deferred-cart-sidebar.tsx` |
| Utility modal + mobile menu deferred | `hero-utility-panel.tsx` `dynamic(() => import('./UtilityModal'), {ssr:false})`; `navbar.tsx` `dynamic(() => import('./mobile-menu'))` |
| Product-grid interactivity gated | `HomeProductGrid` `useDeferredActivation` + `deferred-ad-unit` |
| Hero autoplay gated off LCP | `hero-mobile-carousel.tsx` `userPaused=true` default — timed rotation only starts on explicit Play |
| ₦ font subset (kills 86 KB latin-ext) + Inter not preloaded | root `layout.tsx` `interNaira` display:optional; `inter` `preload:false` |
| Heavy libs route-split | supabase/tiptap/puck/dnd-kit/country-flags/libphonenumber/framer-motion/fuse all off home (see §5) |
| WebMCP registration deferred | `webmcp-storefront-tools.tsx` module-scope `import('./…-registration')` |

The **PR-WEIGHT** batch in `docs/perf/ogabassey-cwv-headroom-execution-plan.md` (§ "PR-WEIGHT") already scopes JS/font/HTML weight work; this cut-list is the concrete home-JS slice of it. Change 6 there already gestures at `<Activity>`-based deferral for offscreen carousel slides and a Flight-prop audit.

---

## 4. Ranked cut-list

Ranked by **impact ÷ risk**. "Impact" reflects both bytes and **main-thread hydration work removed from the LCP window** (the dominant cost on slow Android CPUs — small KB can still be a real win here).

| # | Candidate | Why it's on the boot path | Est. saving | Change | Risk | #3046-style precedent? |
|---|---|---|---|---|---|---|
| 1 | **Defer the analytics wrapper graph** (`AnalyticsPixelProvider` + `lib/analytics` + `lib/event-tracking` + `consent-mode` + 5 pixel wrappers) below LCP | Statically imported by `ogabassey-home-dynamic-content.tsx`; hydrates in the streamed subtree | **~14 KB parse + its hydration** off the critical window | Wrap the provider in an idle/interaction activation gate (same shape as `DeferredPageViewTracker`/`DeferredPlatformInsights`); pixels are already `lazyOnload` so nothing user-visible moves | **Low** | **Yes** — `DeferredPageViewTracker`, `DeferredPlatformInsights`, #3046 |
| 2 | **Lazy-hydrate the mobile hero carousel island** (`HeroMobileCarousel` + `LaunchCarousel` + swipe/play/progress) | `HeroMobileCarousel` is `'use client'` and is the **above-the-fold hero on mobile — the exact slow cohort**; it hydrates eagerly even though autoplay is already gated | **~6–8 KB + the above-the-fold client-island hydration** removed from the LCP main-thread window on mobile | Render slide 0 as static server HTML (already the geometry-parity shell), attach the interactive carousel wrapper on `requestIdleCallback`/first pointer via `useDeferredActivation` or React 19.2 `<Activity>`. Desktop grid is already server-only. Keep SEO links server-rendered (already are) | **Low–Med** | **Yes** — `HomeProductGrid` `useDeferredActivation`; PR-WEIGHT `<Activity>` note |
| 3 | **Lazy-mount `Toaster`** in root `layout.tsx` | Eager on **every** page incl. home; Radix toast runtime + hydration; never shown at LCP | ~2–4 KB + hydration, platform-wide | Mount the toast viewport on first `toast()` call (subscribe-then-lazy) or behind an idle gate | **Low** | Partial — same defer pattern |
| 4 | **Slim the eager cart hydration** (`use-cart` 3.75 + provider 2.65 + `cart/*` 4.52 ≈ 11 KB) | Cart context is eager because the **navbar cart badge** needs the count; validation is already `deferValidationUntilIdle` | ~3–6 KB if the badge reads a minimal count store and the heavier cart logic lazy-loads on cart open | Split a tiny "cart count" store (already Zustand) from the full cart hook graph; lazy-load mutation/validation logic on first cart interaction | **Med** | Weak — touches commerce state; needs its own tests |
| 5 | **Set a modern `browserslist`** to shrink the 39 KB nomodule polyfill + reduce module-bundle down-levelling | No `.browserslistrc` / `package.json#browserslist` exists → Next default ships a legacy polyfill chunk + more transpile helpers | Up to ~39 KB nomodule (legacy clients) + smaller module-bundle helpers for the Chrome cohort | Add a `browserslist` targeting the real cohort (e.g. `chrome >= 111, and_chr, ios >= 15`) after confirming the Nigeria Android version/engine mix | **Med–High** | No — **measure-first**; Nigeria has Opera-Mini/UC/old-WebView share that the polyfill protects |
| — | **Guardrails (not cuts):** keep supabase-importing modals behind their `lazy()` boundaries (regression test); revisit `experimental.viewTransition:true` (CWV plan flags it INP-negative) — behaviour change, owner sign-off | | | | | |

---

## 5. Per-item evidence

**Heavy libs are route-split off home (the core finding).** Import-graph tracing:
- `@supabase/*` browser client: imported by `hooks/merchant/merchant-provider.tsx` (`useRef(createClient())`, line 182) — but that is the **dashboard** `MerchantProvider`. The **storefront** wrapper `hooks/merchant/storefront-merchant-provider.tsx` is a pure SSR-data provider with **no** `createClient()` and **no** supabase import. The remaining supabase-importing storefront components (`checkout-page`, `cart-page-wrapper`, `NegotiationModal`, `CheckoutIdentityModal`, `order-details`, `BlogSnippet`) are all on other routes or behind `deferred-cart-sidebar`/`storefront-deferred-footer-chrome` (`lazy()`). `customer-auth-context.tsx` does not import supabase and its provider (`customer-auth-layout.tsx`) is only applied under `(customer)/(commerce)/(utility)` nested layouts — **not** `(home)`.
- `@tiptap`/`prosemirror`: only `components/blog/*` editor + `components/ui/rich-text-editor.tsx` + blog renderer. Blog/admin routes, not home.
- `framer-motion`/`motion`: **zero** importers inside `components/storefront/ogabassey/**` (grep). Lives in generic `blocks/*`, `new-template/*`, dashboard analytics, `RepairBookingWizard`.
- `fuse.js`: only `components/storefront/product-grid.tsx` (generic grid). Home uses the separate `HomeProductGrid`. `NavbarSearch` does not import fuse.
- `country-flag-icons` / `libphonenumber-js`: transitive via checkout phone/country inputs; no home-tree importer.
- `@puckeditor`/`@dnd-kit`: builder (`components/builder/*`, `puck-storefront.tsx`).

**#1 Analytics wrappers eager.** `ogabassey-home-dynamic-content.tsx` line 5 `import { AnalyticsPixelProvider }` (static) + line 227 render. Wrapper sizes measured: `lib/analytics.ts` 5.99, `lib/event-tracking.ts` 3.09, `analytics-pixel-provider.tsx` 0.64, GA/FB/TT/Snap/Tw 0.60–0.84 each, `consent-mode.ts` 0.59. The gtag/fbevents *scripts* are already `strategy="lazyOnload"`, so only the wrapper JS is the target.

**#2 Mobile hero carousel.** `hero-mobile-carousel.tsx` is `'use client'` (line 1) with `useEffect` reduced-motion + range effects and `useHeroSwipe`; sizes: hero-mobile-carousel 2.44, hero-desktop-grid 2.27 (server-only — not a client cost), + carousel bits. Comment at lines 48–52 already notes LCP-vs-autoplay tension and gates rotation behind explicit Play, so the residual cost is **client-island hydration**, not the timer.

**#3 Toaster.** Root `layout.tsx` line 153 `<Toaster />` (eager, outside Suspense). `components/ui/toaster.tsx` `'use client'` → Radix `@radix-ui/react-toast`.

**#4 Cart.** `[slug]/layout.tsx` `StorefrontCartProvider … deferValidationUntilIdle`. `use-cart` 3.75 + `storefront-cart-provider` 2.65 + `cart/*` 4.52 measured eager; navbar reads `useCart()` for the badge.

**#5 Polyfills.** `polyfill-nomodule.js` = 39.4 KB in the client static output; no `browserslist` key in `apps/web/package.json` and no `.browserslistrc`. Modern Chrome does not download `nomodule` scripts, so this specific chunk does not hit modern Android/Chrome — the module-bundle down-levelling (transpile helpers) is the part that does, and is smaller/harder to isolate.

---

## 6. Start here (top 3)

1. **Defer the analytics wrapper graph below LCP** — lowest risk, cleanest precedent (`DeferredPageViewTracker`), ~14 KB + hydration off the critical path, and pixels already load at idle so nothing user-facing changes.
2. **Lazy-hydrate the mobile hero carousel island** — best-targeted at the finding: it is the one eager above-the-fold client island on the *exact* slow cohort (mobile Android), and it removes hydration *work* from the LCP main-thread window on slow CPUs. Autoplay is already gated, so the change is pure hydration deferral with the geometry shell already in place.
3. **Lazy-mount the root `Toaster`** — trivial, platform-wide, zero LCP dependency.

Do #5 (polyfills) only after pulling the Nigeria Android browser/engine/version mix from CrUX/PostHog — it is the "legacy-transpile weight" the finding hypothesises, but the nomodule chunk is already skipped by modern Chrome and dropping polyfills risks the Opera-Mini/UC/old-WebView slice.

---

## 7. Honest framing for the slow-Android tail

Because the home entry is already lean, **JS cuts alone are unlikely to move p75 from ~5.3 s to target on their own.** The three JS levers together remove on the order of **~20–25 KB of eager parse plus two above-the-fold hydration islands** — real and worth doing on slow CPUs, but incremental. The larger remaining contributors for the Android/Nigeria cohort are structural and already named in the CWV headroom plan:
- **Framework hydration cost on slow CPUs** — the ~63 KB react-dom + client runtime floor parses/hydrates far slower on low-end Android; deferring non-LCP islands (levers 1–3) is the main way to relieve it without ejecting from the framework.
- **Network / TTFB** — Nigeria RTT floor + Vercel cold-start + RSC render (Ops-2 SWR/Early-Hints and the region pin `dub1` are the plan's levers here, not JS).
- **INP/long-frame attribution** — PR-MEASURE's LoAF data should confirm whether hydration bursts vs ad boot dominate before further JS surgery.

Recommend pairing the JS cut-list with a fresh **DebugBear/PSI + PostHog LoAF** read on the mobile-Android segment to confirm the JS-execute share of LCP load-delay before investing beyond levers 1–3.

---

## 8. Measurement caveats (honest)

1. **Real per-module compressed sizes: yes.** All KB figures come from a **successful** `next experimental-analyze --output` production build (`chunk_parts[].compressed_size`), not estimates.
2. **Exact home entry-chunk manifest: not machine-extracted.** The analyze build did not leave a standard `app-build-manifest.json` (it wrote the diagnostic graph instead), and Turbopack's binary reachability index (`source_children`/`source_roots` in `analyze.data`) uses a non-standard, non-CSR layout I could not reliably decode (traversal collapsed to 12 nodes / mis-rooted at an OpenTelemetry module). **Home-path membership is therefore established by source import-graph tracing** (grep of static `import`/`dynamic`/`lazy` across the traced tree), which is reliable for static imports but cannot, on its own, prove a module lands in the *first-flush* entry chunk vs a same-route split chunk. Where a size is attributed to "eager home," it means: reachable via static imports from the home client tree AND present in a `/static/*.js` client chunk.
3. **Compressed sizes are the analyzer's compression, not the CDN's Brotli-11.** Treat them as consistent relative measures; absolute wire bytes on `cdn`/Vercel Brotli will differ by a few %.
4. **No live field re-measure done here** (read-only). The plan's non-negotiable rule stands: confirm any win with post-deploy PSI + DebugBear + PostHog on the mobile-Android segment before claiming movement.
5. Sizes for cross-route modules (e.g. `@supabase` 74.7 KB) are whole-build figures used only to prove those libs are *off* the home entry; they are not part of the home budget.
