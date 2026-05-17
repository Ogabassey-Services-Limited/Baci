# Storefront LCP Interventions Plan — 2026-05-13

## Context

Follow-up to the LCP baseline audit at [docs/audits/2026-05-13-storefront-lcp-baseline.md](../../audits/2026-05-13-storefront-lcp-baseline.md). PR #1607 cut mobile home element render delay in half (893 -> 377 ms), but mobile home LCP was still 3226 ms (poor) and PDP desktop LCP was 2769 ms (poor) with the mobile PDP timing out in PSI entirely.

The audit identified five Core Web Vitals interventions in priority order. This plan sequences them across separate PRs so each can be measured independently before the next lands. Hot-take fixes ship first; diagnostic-required ones get a recon step.

2026-05-16 update: PR #1693 restored the OgaBassey hero image to static-imported Next.js media assets after PR #1674/#1684's public-asset `headers()` path served cached HTML instead of images in production. Live response headers now preload immutable `/_next/static/media/...avif` assets, and PSI after deploy measured:

| Page | Strategy | Perf | SEO | LCP | TBT | CLS | Status |
|---|---|---:|---:|---:|---:|---:|---|
| OgaBassey home | mobile | 89 | 100 | 3376 ms | 87 ms | 0.001 | LCP still poor |
| OgaBassey home | desktop | 90 | 100 | 910 ms | 229 ms | 0.000 | Good LCP |
| OgaBassey PDP | mobile | 78 | 100 | 4201 ms | 118 ms | 0.000 | LCP still poor |
| OgaBassey PDP | desktop | 89 | 100 | 1583 ms | 152 ms | 0.045 | Good LCP |

2026-05-16 Google AI Search guidance check: Google's official "Optimizing your website for generative AI features on Google Search" guide says generative AI visibility still depends on normal Search fundamentals: crawlable/indexable pages, clear technical structure, JavaScript SEO, good page experience, ecommerce details, high-quality images/video, unique people-first content, and agent-friendly experiences. Its linked crawling/ecommerce docs add that crawl budget depends heavily on URL inventory quality, crawlable `<a href>` internal links, consistent canonical/sitemap/internal-link URLs, category-to-product navigation, pagination with real links, and controlling duplicate/faceted/filter URL spaces. It also says not to chase AEO/GEO hacks such as `llms.txt`, AI-only chunking, or special schema solely for AI Search. This plan now keeps the LCP loop as the blocking technical track and adds an AI Search readiness track after the live CWV pages are stable.

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
| 6 | Google AI Search, internal-linking, and crawl-budget readiness audit | Audit → focused fixes | Half-day | SEO/AI Search eligibility hardening | Added 2026-05-16 from Google's AI optimization guide and linked crawling/ecommerce docs; run after the current LCP blockers or in parallel if no code conflicts |

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

**2026-05-15 update after PR #1671.** Live PSI now reports mobile home LCP at 3376 ms with about 2080 ms resource load delay. The live HTML shows the hero image hints are emitted as React/Next RSC `:HL[...]` stream records after the initial head/scripts/fallback shell, not as native `<link rel="preload" as="image">` tags in the initial `<head>` or HTTP `Link` response header. Per Next.js 16 docs, the Metadata API does not directly support arbitrary resource hints; ReactDOM resource hints are supported, but the current placement is still too late for this streaming route.

**2026-05-15 PR #1674 correction, superseded.** The public-asset approach was invalid in production. Serving content-hashed hero files from `public/` and stamping immutable cache headers through `next.config.ts headers()` caused Vercel to route matching asset requests through the storefront catch-all and cache HTML as `image` preload targets. Do not revive that mechanism.

**2026-05-16 PR #1693 correction.** The canonical approach for this app is static image imports that emit `/_next/static/media/<contenthash>.avif` URLs. Those assets are served as `image/avif` with `cache-control: public,max-age=31536000,immutable`, bypass the `[slug]` catch-all, and match the live home preload targets. Any future home hero preload change must preserve URL equality between the preload target and the actual rendered image request.

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

## Fix 6 — Google AI Search, internal linking, and crawl-budget readiness audit

**Problem.** PSI SEO is 100, but Google's 2026 AI Search guidance is broader than Lighthouse's SEO checklist. It emphasizes crawlable/indexable technical structure, people-first non-commodity content, ecommerce data sources, high-quality images/video, Search Console monitoring, and agent-friendly browser/DOM/accessibility behavior. The linked Google crawling/ecommerce docs also make internal linking and URL inventory quality first-class: Google uses links to find pages and infer site structure; crawl budget is wasted by duplicates, soft 404s, long redirects, temporary parameters, empty categories, and uncontrolled faceted/filter URL spaces. The current plan covers Core Web Vitals and some crawl risk, but it does not explicitly verify those AI Search readiness surfaces.

**Source of truth.**
- Google's guide: `https://developers.google.com/search/docs/fundamentals/ai-optimization-guide`
- Existing Baci machine-readable surfaces: `/feeds/openai.jsonl`, `/agent-commerce.json`, `/agent-trust.json`
- Existing Search surfaces: `robots.txt`, `sitemap.xml`, blog sitemap, canonical URLs, Product/Organization/Breadcrumb JSON-LD, Merchant Center feeds
- Google linked docs to apply in this audit:
  - `https://developers.google.com/search/docs/crawling-indexing/links-crawlable`
  - `https://developers.google.com/crawling/docs/crawl-budget`
  - `https://developers.google.com/search/docs/crawling-indexing/url-structure`
  - `https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure`
  - `https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites`
  - `https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading`
  - `https://developers.google.com/crawling/docs/faceted-navigation`

**Do not do.**
- Do not add `llms.txt` or AI-only markdown files as a ranking tactic.
- Do not create thin "query fan-out" pages that exist only to target long-tail AI prompts.
- Do not add special schema markup solely for generative AI Search. Keep structured data tied to eligible Google rich-result features and ecommerce needs.
- Do not rewrite product/blog copy into generic AI-style summaries; preserve specific merchant expertise and first-hand product details.
- Do not create indexable filtered/sorted/search-result URL spaces unless they have unique user value, stable URLs, canonical handling, and direct sitemap/internal-link support.

**Audit steps.**

1. Crawl/index eligibility:
   ```bash
   curl -sSI https://ogabassey.com/
   curl -sS https://ogabassey.com/robots.txt
   curl -sS https://ogabassey.com/sitemap.xml | head
   curl -sS https://ogabassey.com/blog/sitemap.xml | head
   ```
   Expected: public pages return `200`, no accidental `noindex`, canonical host is `https://ogabassey.com`, and sitemap entries are current.

2. Internal linking and ecommerce crawl paths:
   - Use a small crawl script or browser DOM inspection over home, top categories, a paginated category page, representative PDPs, blog index, and representative blog posts.
   - Confirm links that matter are real `<a href>` anchors, not only `onClick`, buttons, spans, router-only attributes, or JavaScript search flows.
   - Confirm every indexable page class has at least one internal crawl path:
     - Home -> top categories
     - Category -> subcategory or product listing pages
     - Category/pagination -> products reachable without search-box submission
     - PDP -> category/breadcrumbs and relevant related products or buying-guide/blog context
     - Blog post -> relevant category or PDP links when genuinely helpful
   - Confirm anchor text is descriptive and human-readable; avoid generic "click here", empty anchors, and image-only links without useful `alt`.
   - Promote genuinely important categories/products from home, category modules, or relevant blog content. Do not add excessive link blocks; Google says there is no ideal number of links, and user value is the guardrail.

3. URL inventory and crawl-budget controls:
   - Compare internal links, sitemap URLs, canonical tags, Merchant Center feed URLs, and machine-readable commerce URLs for the same representative products. They should point to the same preferred canonical URL.
   - Confirm product/category URLs use stable, descriptive paths and avoid temporary parameters such as session IDs, tracking codes, current time, or user-relative filters in internal links.
   - Confirm removed products/categories return the right final state: live useful page, `404`/`410`, or deliberate noindex for an empty-but-user-visible category. Avoid soft 404 pages.
   - Audit filter/sort/search URLs for crawl traps:
     ```bash
     curl -sSI 'https://ogabassey.com/laptops?sort=price-asc'
     curl -sSI 'https://ogabassey.com/laptops?color=black&storage=256gb'
     curl -sSI 'https://ogabassey.com/search?q=iphone'
     ```
     Decide whether these should be indexable, canonicalized to an unfiltered/listing page, `noindex`, or blocked in robots.txt. Prefer blocking/noindex for filter/sort combinations that do not add unique Search value.
   - For faceted URLs that must be crawlable, enforce standard `?key=value&key2=value2` parameters, stable filter ordering, no duplicate filters, and `404` for impossible/no-result combinations.

4. Pagination and incremental loading:
   - Confirm paginated category/listing pages have unique URLs such as `?page=2` and sequential `<a href>` links to the next page.
   - Do not rely only on "Load more" buttons or infinite scroll for discoverability; Google crawlers generally do not click buttons or trigger user-action JavaScript.
   - Do not canonicalize every paginated page to page one. Each indexable page in a useful paginated sequence should have its own canonical URL.
   - Avoid indexing alternate sort/filter pages that duplicate the same product set.

5. JavaScript SEO and rendered content:
   - Use Chrome or Vercel agent-browser on the live home, category, PDP, and blog article URLs.
   - Confirm primary product names, prices, availability, hero content, and blog article text are present in rendered DOM without requiring user interaction.
   - Confirm the same pages remain readable with slow network and mobile viewport.

6. Structured data and ecommerce details:
   - Run Google's Rich Results Test or inspect HTML for Product, Organization, Breadcrumb, Article/BlogPosting where applicable.
   - Confirm Product JSON-LD includes current price, availability, image, URL, and merchant identity.
   - Confirm Merchant Center feed parity for representative OgaBassey products; do not rely only on on-page JSON-LD.

7. People-first content quality:
   - Sample OgaBassey home, top category pages, PDPs, and blog posts.
   - Flag thin commodity copy, duplicate boilerplate, missing first-hand product context, missing comparison/use-case detail, or stale product claims.
   - Add copy tasks only where a human shopper would get clearer buying guidance; avoid scaled-content patterns.

8. Duplicate/canonical hygiene:
   - Compare apex vs `www`, custom-domain vs slug route, and old product/category aliases.
   - Confirm canonical URLs collapse to the preferred public URL and that duplicate paths do not waste crawl budget.

9. Agent-friendly website pass:
   - Verify DOM structure, headings, labels, buttons, forms, cart actions, and PDP purchase flow through the accessibility tree.
   - Confirm machine-readable commerce/trust endpoints are live and consistent with visible storefront data.
   - Capture failures as normal accessibility/semantic HTML bugs, not as AI-only hacks.

**Validation.**
1. PSI SEO stays 100 on home, category, PDP, and blog pages.
2. Rich Results Test passes for representative PDP and blog article pages.
3. Search Console inspection or URL live tests show indexable canonical pages.
4. Merchant Center feed/product data remains consistent with live PDP content.
5. Agent-browser/Chrome checks can identify primary content and purchase actions through DOM/accessibility, not screenshots only.
6. Internal-link crawl map proves each indexable page class is reachable by crawlable `<a href>` paths, with descriptive anchors and no search-only product discoverability.
7. URL inventory audit finds no uncontrolled duplicate, session, temporary, faceted, sorted, or empty-category URL spaces wasting crawl budget.

**Risk.** Medium. Content and canonical changes can affect ranking/indexing if made broadly. Keep fixes narrow and test representative URLs before expanding.

**Acceptance criteria.** No AI Search-specific hacks added; OgaBassey remains crawlable/indexable with clear technical structure, current ecommerce data, useful product/content pages, crawlable internal links, controlled URL inventory, stable structured data, and agent-readable commerce actions.

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
- Any SEO/AI Search change creates thin duplicate pages, non-human copy, uncontrolled URL inventory, or schema that is not tied to a real eligible Search feature

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
- **Not adding AEO/GEO hacks.** Google's 2026 AI Search guidance explicitly says normal SEO fundamentals still apply; do not add `llms.txt`, special AI markup, artificial mentions, or chunked pages just for AI systems.

---

## Hand-off

When work starts on each fix:
1. Open a draft PR off `main` (small worktree, branch per fix: `chore/lcp-pdp-image-priority`, `chore/lcp-home-resource-delay`, etc.)
2. Reference this plan and the audit in the PR description
3. Include the per-fix acceptance criteria as checkboxes in the PR description
4. Re-measure PSI after merge, update the audit doc's tracking table
