# Storefront LCP Interventions Plan — 2026-05-13

## Context

Follow-up to the LCP baseline audit at [docs/audits/2026-05-13-storefront-lcp-baseline.md](../../audits/2026-05-13-storefront-lcp-baseline.md). PR #1607 cut mobile home element render delay in half (893 → 377 ms), but mobile home LCP is still 3226 ms (poor) and PDP desktop LCP is 2769 ms (poor) with the mobile PDP timing out in PSI entirely.

The audit identified five interventions in priority order. This plan sequences them across separate PRs so each can be measured independently before the next lands. Hot-take fixes ship first; diagnostic-required ones get a recon step.

URL set, measurement script, threshold values: see [docs/perf/storefront-lcp-urls.md](../../perf/storefront-lcp-urls.md).

---

## Sequencing strategy

| Order | Fix | Type | Effort | Est. LCP gain | Detailed plan? |
|---|---|---|---|---|---|
| 1 | PDP banner LCP preload hint (server-side `<link rel="preload">`) | New component + mount | 1-2 h | **−1500 to −2000 ms PDP desktop** | ✅ [2026-05-13-pdp-banner-lcp-priority.md](2026-05-13-pdp-banner-lcp-priority.md) — strategy revised 2026-05-13 after finding `BannerCarousel` is `dynamic({ ssr: false })` on PDP; image-prop changes alone don't reach initial HTML |
| 2 | Mobile home resource-load-delay recon + fix | Diag → fix | 2–4 h | −200 to −800 ms | Pending diagnostic |
| 3 | PDP JS bundle audit + tree-shake | Diag → fix | Half-day | −500 to −1500 ms TBT; ~−900 ms mobile LCP | **Prep doc**: [2026-05-14-fix3-pdp-bundle-trim-prep.md](2026-05-14-fix3-pdp-bundle-trim-prep.md) — library-presence findings + per-file-mapping methodology captured. Pick up here to produce the actual TDD plan. |
| 4 | Storefront critical CSS / FCP reduction | Diag → fix | Half-day | −200 to −400 ms FCP | **Re-scoped — see note below** |
| 5 | Lighthouse-UA cache bypass investigation | Diag | 1 h | SEO risk reduction | Pending diagnostic |

### Note on Fix 4 re-scoping

While preparing detailed plans, found that the team has already tried **both** of Next.js 16's automated critical-CSS options and rejected them ([apps/web/next.config.ts](../../../apps/web/next.config.ts:experimental)):

- `inlineCss: false` — *"inflated the streamed storefront HTML/RSC payload on ogabassey.com and duplicated large Tailwind/global CSS chunks in the initial document"*
- `optimizeCss` (Critters) — *"incompatible with App Router streaming"*

So Fix 4 isn't a config flip — it needs its own diagnostic to identify a streaming-compatible approach (manual critical-CSS inlining, a Beasties variant, or accepting current FCP as the floor). Treating it as diagnostic-first now.

**Re-measure after each PR merges + deploys.** Use the same PSI script + URL set. If a fix doesn't deliver its expected gain, stop and re-diagnose before proceeding to the next.

---

## Fix 1 — PDP banner preload hint (highest leverage)

**Problem.** The PDP LCP element is the "Flash Sale" banner image, but the banner lives inside `BannerCarousel`, which is imported with `dynamic(..., { ssr: false })` and only mounts after `ProductDetailsPage` detects the desktop viewport in a client `useEffect`. Directly changing `BannerCarousel` image props is therefore too late for the initial HTML parse and does not address the resource-discovery delay.

**Detailed implementation plan.** Use [2026-05-13-pdp-banner-lcp-priority.md](2026-05-13-pdp-banner-lcp-priority.md). That plan creates an OgaBassey PDP Server Component resource-hints module and mounts it from the active PDP route before `<OgabasseyProductPage>`.

**Implemented in PR #1634.** Emit one desktop-scoped server-side `<link rel="preload" as="image">` hint using `getImageProps()` plus the explicit app `imageLoader` so the preload candidates match the custom-loader transformed `/image/width=...,quality=75,format=webp/...` URLs that `next/image` will request after hydration. Keep an `href` fallback alongside `imageSrcSet` / `imageSizes` for Firefox coverage, and scope it with `media="(min-width: 768px)"` because the PDP banner wrapper is `hidden md:block`.

**Do not do.** Do not flip `priority`, `loading`, or `fetchPriority` inside `BannerCarousel` as the primary fix. That component is client-only on PDP, so any hints emitted there arrive after the LCP discovery window.

**Validation.**
1. Follow the focused TDD, lint, typecheck, CodeRabbit, and PR steps in [2026-05-13-pdp-banner-lcp-priority.md](2026-05-13-pdp-banner-lcp-priority.md).
2. Visual: load the live deploy on a PDP, confirm the Flash Sale image still renders correctly after hydration.
3. After merge: verify production HTML contains a transformed `href`, `imagesrcset`, and `imagesizes` preload with `media="(min-width: 768px)"`, then re-run PSI on the canonical PDP URL `https://ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090` (desktop).

**Risk.** Low-medium. The code change is small, but preload mistakes can create duplicate critical-path downloads if the emitted candidates do not match the custom image loader.

**Acceptance criteria.** PDP desktop LCP under 1500 ms post-deploy.

---

## Fix 2 — Mobile home resource-load-delay diagnostic + fix

**Problem.** Mobile home LCP is 3226 ms, of which 1806 ms is resource load delay. The hero image is correctly preloaded (`fetchpriority="high"`, `loading="eager"`, viewport-scoped `<link rel="preload">`, request discoverable). All standard 2026 best practices satisfied. Yet the request starts ~1.8 s after navigation.

**2026-05-15 update after PR #1671.** Live PSI now reports mobile home LCP at 3376 ms with about 2080 ms resource load delay. The live HTML shows the hero image hints are emitted as React/Next RSC `:HL[...]` stream records after the initial head/scripts/fallback shell, not as native `<link rel="preload" as="image">` tags in the initial `<head>` or HTTP `Link` response header. Per Next.js 16 docs, the Metadata API does not directly support arbitrary resource hints; ReactDOM resource hints are supported, but the current placement is still too late for this streaming route. The active fix is to put the OgaBassey home LCP assets on stable public URLs and emit a route-scoped native HTTP `Link` header for `ogabassey.com/`.

**Diagnostic step (no code change first).**

1. Open Chrome DevTools → Network panel
2. Disable cache, throttle to "Slow 4G", reload `https://ogabassey.com/` on mobile emulation
3. Identify what runs in the window between navigation start and the hero image request firing
4. Look specifically for:
   - CSS files marked "Highest" priority that load before the image
   - Render-blocking CSS in `<head>` (no `media="print"`, no `disabled`)
   - Other preload links competing (the response includes `link: <css>; rel=preload`)
   - Third-party scripts initiating connections (AdSense, DoubleClick from CSP)
   - HTTP/2 stream priorities — check Connection View / waterfall
5. Save a HAR file for the audit doc reference

**Likely findings + fixes:**
- **If CSS preloads block image:** the `link: ...; rel=preload; as="style"` header for `_next/static/chunks/*.css` may be queued before the image preload. Solutions: defer non-critical CSS chunks, inline critical CSS so fewer chunks need preloading, or downgrade their preload priority.
- **If third-party scripts compete:** check that AdSense/DoubleClick are loaded with `strategy="lazyOnload"` via `next/script`. If they're sync or `afterInteractive`, they could trigger early connections.
- **If render-blocking CSS:** add `media="print" onload="this.media='all'"` pattern or use `next/font` for font CSS specifically.

**Target files (depending on finding).**
- [apps/web/src/app/(storefront)/[slug]/layout.tsx](../../../apps/web/src/app/(storefront)/[slug]/layout.tsx)
- [apps/web/src/app/(storefront)/ogabassey/layout.tsx](../../../apps/web/src/app/(storefront)/ogabassey/layout.tsx)
- Any preload-emitting component (e.g. `OgabasseyStaticResourceHints`)

**Validation.** Re-run PSI on mobile home. Expected resource load delay reduction: 1806 ms → 600–1000 ms. Target overall LCP: 3226 → **~2200–2400 ms** (under threshold).

**Risk.** Medium. CSS / resource hint changes can cause FOIT/FOUC if mis-handled. Visual regression test the storefront after.

**Acceptance criteria.** Mobile home LCP under 2500 ms post-deploy. Resource load delay under 1000 ms.

---

## Fix 3 — PDP JS bundle audit + tree-shake

**Problem.** After PR #1634, PDP desktop LCP improved from 2769 ms to 1357 ms and mobile PDP no longer times out in PSI. Mobile PDP LCP is now 4824 ms, with the LCP image discovery checks passing. The next bottleneck is main-thread cost from unused JS/CSS during the FCP to LCP window: the post-#1634 PSI run shows ~156 KiB unused JS and ~38 KiB unused CSS, plus local production chunks containing heavy libraries (`moment`, `lodash`, `three`, `puck`, `tiptap`, `prosemirror`, `recharts`) that should not be needed on the PDP.

**Prep handoff.** Start from [2026-05-14-fix3-pdp-bundle-trim-prep.md](2026-05-14-fix3-pdp-bundle-trim-prep.md). It records the PSI chunk findings, local library-presence evidence, Turbopack analyzer caveat, reusable `.next/` worktree, and the four-stage methodology for mapping libraries to import sites before choosing interventions.

**Diagnostic step.** Reproduce or refresh the bundle evidence on the PDP route:
```bash
ANALYZE=true pnpm --filter @baci/web build
# Or use the package script directly:
pnpm --dir apps/web analyze
```
Inspect the PDP-relevant chunks using content searches rather than chunk hashes; local and production hashes can differ because env vars affect Turbopack output. Look for:
- Whole libraries imported when only a function is used (`lodash`, `moment`)
- Builder/dashboard/editor libraries leaking into storefront routes (`puck`, `tiptap`, `prosemirror`, `three`, `recharts`)
- Duplicate JS or broad barrels that pull non-PDP code into storefront bundles
- Customer-facing components that do not need to be in the initial PDP path (cart sidebar internals, checkout modal, below-the-fold review widgets)

**Likely interventions** (rank-order by impact, pick top 1-2):
- Dynamic imports for below-the-fold features (`dynamic(() => import(...), { ssr: false })`)
- Replace heavy libs with smaller alternatives (e.g. date-fns over moment, lodash-es with tree-shake)
- Split the PDP route's client bundle from shared bundles via Next.js route groups or dynamic imports

**Target files.**
- The PDP page component (likely `apps/web/src/components/storefront/ogabassey/pages/product-details-page/...` based on the audit's grep history)
- [apps/web/next.config.ts](../../../apps/web/next.config.ts) for `optimizePackageImports`, bundle-analyzer enable

**Validation.**
1. Re-run bundle analysis or direct chunk-content inspection; PDP unused JS should drop below 80 KiB and unused CSS below 20 KiB
2. PSI desktop: TBT should stay below 300 ms and LCP should not regress from the post-#1634 1357 ms result
3. PSI mobile: LCP should improve from 4824 ms toward the next target without reintroducing timeouts
4. Build size diff in PR description

**Risk.** Medium. Code-splitting can break SSR or hydration if components are misclassified. Visual + interaction regression test the PDP (add to cart, image gallery, reviews) after.

**Acceptance criteria.**
- PSI mobile PDP completes successfully (no timeout)
- PSI unused JavaScript under 80 KiB and unused CSS under 20 KiB
- PDP desktop TBT under 300 ms
- PDP mobile LCP under 3500 ms for this bundle-trim PR; under 2500 ms remains the overall storefront target after later fixes

---

## Fix 4 — Storefront FCP / critical CSS diagnostic

**Problem.** Mobile home FCP is 1201 ms. The response includes multiple `<link rel="preload" as="style">` chunks — Chrome must download + parse each before paint. However, this is no longer a simple Next.js config flip: current `next.config.ts` already documents why `experimental.inlineCss` and Critters/`optimizeCss` were rejected for this App Router streaming setup.

**Approach.** Diagnose first, then choose a streaming-compatible fix.

1. Identify the minimal CSS needed for the above-the-fold render of storefront home + PDP. Likely:
   - Tailwind base/reset
   - Theme CSS variables (merchant brand colors)
   - Hero layout classes
   - Header/navbar classes
2. Confirm in a Chrome performance trace whether CSS download/parse is actually blocking FCP, or whether RSC/HTML payload, font timing, or hero client hydration is the real limiter.
3. If CSS is confirmed as the limiter, prototype a route-scoped manual critical-CSS slice in a preview branch and compare FCP/LCP/CLS before committing to the approach.

**Do not do.** Do not re-enable `experimental.inlineCss` or `experimental.optimizeCss` as the default first move; the current config comments record prior regressions/incompatibility. Any revisit must be an explicit measured experiment in a preview branch.

**Target files.**
- [apps/web/next.config.ts](../../../apps/web/next.config.ts) (read current CSS config comments; avoid blind flips)
- [apps/web/src/app/(storefront)/[slug]/layout.tsx](../../../apps/web/src/app/(storefront)/[slug]/layout.tsx) (only if a route-scoped manual critical CSS experiment is justified)

**Validation.**
1. PSI mobile home FCP: 1201 → target under 800 ms
2. Visual: confirm no FOUC (flash of unstyled content) on storefront load
3. CLS check: confirm CLS stays under 0.1 (critical CSS shouldn't shift layout once full CSS arrives)

**Risk.** Medium. FOUC and CLS regressions are the main hazards. Test on slow connections + multiple viewports.

**Acceptance criteria.** Mobile home FCP under 800 ms, CLS unchanged or improved.

---

## Fix 5 — Lighthouse-UA cache bypass investigation

**Problem.** Responses with `User-Agent` containing "Lighthouse" return `cache-control: private, no-cache, no-store, max-age=0, must-revalidate` and `x-vercel-cache: BYPASS`. PSI's default UA (`HeadlessChrome/146`) does not include "Lighthouse" so PSI is unaffected. But if Googlebot's mobile crawler or other bot/audit tools include "Lighthouse" in their UA, they get an uncached origin response — slower than what real users see, potentially affecting SEO ranking signals.

**Diagnostic step.**

1. Identify the source of the rule. Likely candidates (search each):
   ```bash
   grep -rn "Lighthouse" apps/web/src/proxy.ts apps/web/src/middleware* 2>/dev/null
   grep -rn "Lighthouse" apps/web/next.config.ts vercel.json 2>/dev/null
   # Vercel Firewall / edge-config rules — check via Vercel dashboard
   # Cloudflare WAF (if in front of Vercel) — check Cloudflare dashboard
   ```
2. If found in code: determine the intent (anti-bot? performance shielding? scrape protection?)
3. Check what UAs Googlebot uses in 2026:
   - Mobile: `Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 ... Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)`
   - No "Lighthouse" — Googlebot is unaffected by the current rule
4. Test Calibre's WebPageTest UAs (commonly used by perf-monitoring services)

**Decision tree.**
- **If the rule only blocks UAs literally containing "Lighthouse" and Googlebot doesn't:** no fix needed. Document the finding as expected behavior in the audit and close.
- **If the rule has wider catch (e.g. matches "bot", "headless", etc.):** narrow it to just the specific bots that need cache-bypass, leave Googlebot + real Lighthouse alone (Google's own real-Lighthouse-UA crawler still uses "Lighthouse" string for some checks).
- **If unclear intent:** ping whoever added the rule (git blame on the matching file) before changing.

**Validation.** No code change in the default path. If a fix is needed, validate with curl tests using a range of bot UAs.

**Risk.** Low when read-only. Medium if changing the rule — could let unwanted scrapers through.

**Acceptance criteria.** Document captured. Decision made (fix or leave). If fixed, ranking-affecting bot UAs return cached responses.

---

## Cross-cutting concerns

### Re-measurement cadence

After every PR merges + Vercel deploy completes:
1. Wait for `deploy-production` check-run to report `completed: success` for the merge commit
2. Verify CDN is fresh: `curl -sI https://ogabassey.com/ | grep -iE "age|cache"` — `age: 0` or `x-vercel-cache: PRERENDER` confirms fresh
3. Run PSI baseline (same URL set + script as audit)
4. Append a row to [docs/audits/2026-05-13-storefront-lcp-baseline.md](../../audits/2026-05-13-storefront-lcp-baseline.md)'s tracking table (add the table on first re-measure)

### Halt conditions

Stop the plan and re-diagnose if any of:
- A fix delivers <30% of its expected LCP gain (signals the diagnosis was wrong)
- Any fix regresses any other CWV metric beyond noise
- CLS exceeds 0.1 on any measured page (would need to roll back the offending fix)

### Tooling fix (parallel track)

The `apps/web/tools/seo/run-pagespeed.cli.ts` script trips on local Node 24 + tsx with "top-level await not supported with cjs output." Currently using `/tmp/run-psi-direct.mjs` as a workaround. Fix in a separate tiny PR — either:
- Add `"type": "module"` to `apps/web/package.json` (broader implication; affects all .js in that package)
- Wrap the top-level `await main()` in an async IIFE (smaller blast radius)

Recommended: the IIFE wrap. Tracker-only — not blocking the LCP work.

---

## What this plan is NOT

- **Not PPR or Cache Components adoption.** TTFB is already 1-9 ms on these pages; server response isn't the bottleneck. Revisit only if Fix 2 reveals an unexpected server-side cause.
- **Not a font optimization pass.** `next/font` with `display: 'swap'` is already in place per the audit findings.
- **Not changing the storefront `MerchantProvider`.** Already optimized (server snapshot pattern).
- **Not adding nightly PSI monitoring CI.** Premature until the baselines stabilize. Add only after Fix 2 + Fix 3 land and we've seen stable post-fix numbers.

---

## Hand-off

When work starts on each fix:
1. Open a draft PR off `main` (small worktree, branch per fix: `chore/lcp-pdp-image-priority`, `chore/lcp-home-resource-delay`, etc.)
2. Reference this plan and the audit in the PR description
3. Include the per-fix acceptance criteria as checkboxes in the PR description
4. Re-measure PSI after merge, update the audit doc's tracking table
