# OgaBassey PDP semantic SEO + Core Web Vitals execution plan

_Last updated: 2026-06-12_

## Current execution position

This document is the working plan for OgaBassey PDP semantic SEO and Core Web Vitals follow-up work. It imports the Koray-style teardown plan and updates it with the current production state after PR #2429 (`02141f62f1 fix(web): block streamed PDP metadata for AI crawlers`), PR #2434 (`fix(web): noindex legacy storefront PDP fallbacks`), the in-flight PR #2435 (`fix(web): harden Ogabassey PDP trust signals`), and the latest PSI/DebugBear measurements.

The strategy is semantic-first and architecture-first: make the canonical PDP understandable, internally consistent, richly connected, bot-readable, and trustworthy before doing more narrow Lighthouse micro-optimizations. Do not chase isolated Lighthouse hints unless they support the entity/page architecture or a clear Core Web Vitals threshold.

### Current-state overrides

- **S1 bot metadata delivery is currently treated as done, pending periodic production regression checks.** PR #2429 shipped the Next `htmlLimitedBots` approach for AI crawlers/HTML-limited bots without disabling metadata streaming for ordinary human/browser traffic.
- The work completed so far has moved from **PDP metadata/head delivery** into **the first PDP trust cleanup pass**, but it has not yet repaired reviews-on-canonical-route, entity attributes, buyer-decision sections, footer/related-link HTML, or PDP LCP internals.
- **S2 canonical/robots leak cleanup is merged.** PR #2434 merged on 2026-06-11 and noindexed the legacy storefront PDP fallbacks. Keep production raw-HTML regression checks, but S2 is no longer the primary next PR.
- **Primary next semantic action:** finish PR #2435 review follow-up, update it from `main`, and merge the S3 trust-contradiction pass. It already covers stale absolute-price sentences and invalid/fake rating signals; variant/color/image contradictions and price/FAB overlap remain open unless separately proven fixed.
- **Primary current lab performance bottleneck:** PDP mobile LCP. Home is close in lab; field data will lag because CrUX is a rolling 28-day field window. No post-#2435 production performance attribution is valid until #2435 is merged and deployed.
- `proxy.ts` remains protected. No proxy diff without explicit approval and a gated replay/preview plan.


### Progress ledger as of 2026-06-12

| Area | Plan phase | Current state | Evidence / next action |
|---|---|---|---|
| Measurement tooling | Phase 0 | **In progress.** PR #2433 is open, CI quality gates are green, but GitHub reports the branch behind base. | DebugBear polling was repaired to use `/project/:projectId/quickTest/:id` when the create response has no poll link. Update from `main`, revalidate, then merge before treating the script behavior as available on `main`. |
| Bot metadata delivery | S1 | **Done, monitor.** | PR #2429 shipped the Next `htmlLimitedBots` architecture. Continue raw bot-UA HTML checks for PDP/category/home. |
| Platform-domain PDP leak | S2 | **Merged.** | PR #2434 merged on 2026-06-11. Keep a production regression check that legacy `/products/<slug>` and `/product/<slug>` fallbacks do not emit indexable platform-domain PDP canonicals. |
| PDP trust contradictions | S3 | **In review / not merged.** | PR #2435 is open. CI quality-gate jobs are green, but Jules reported a medium follow-up: guard `sanitizeCustomProductSchemaMarkup` against nullish/non-object `sanitizeSchemaMarkup` results. Branch also needs latest `main` alignment. |
| Ratings/reviews canonical route | S4 | **Not started, except schema guardrails.** | PR #2435 hardens invalid/custom `aggregateRating` handling and suppresses fake zero-review stars. It does **not** wire approved review stats/reviews into the canonical category PDP route. |
| Entity attributes | S5 | **Open.** | Brand/GTIN/MPN, `og:type=product`, duplicate `additionalProperty`, and variant image/catalog contradictions remain to be split into code-owned vs data-owned work. |
| Buyer-decision content / headings | S6 | **Open.** | Price-in-Nigeria, specs, installment, delivery/warranty, reviews, compare, FAQ, related links, and server-rendered footer links remain after S3-S5. |
| PDP lab LCP residue | Phase 2 | **Open, blocked behind semantic/trust cleanup unless LCP regresses.** | Re-measure after #2435 deploy before adding PDP preconnect/Flight-payload work. |
| Field TTFB/cache experiment | Phase 3 | **Gated / not started.** | Requires explicit approval before any `proxy.ts` diff. |

## Source alignment

This plan is aligned to current public guidance rather than Lighthouse-score chasing:

- Google canonicalization guidance treats redirects, `rel=canonical`, and sitemap inclusion as canonical signals; the execution order prioritizes removing conflicting platform-domain signals before expanding content. Source: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Google review snippet guidance requires review/rating markup to describe visible review content. The plan suppresses aggregate ratings/review structured data when count is zero or the page cannot show matching reviews. Source: https://developers.google.com/search/docs/appearance/structured-data/review-snippet
- Core Web Vitals are judged by the 75th percentile of page loads, segmented by mobile/desktop. The plan uses lab tools for iteration but does not call the goal complete until field-facing template causes are addressed. Source: https://web.dev/articles/vitals
- Next.js App Router supports blocking metadata for HTML-limited bots through `htmlLimitedBots`; S1 used this architecture instead of disabling metadata streaming for all human/browser traffic. Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/htmlLimitedBots

## Current measurement snapshot

### PageSpeed Insights / CrUX

Latest bounded production PSI snapshot after PR #2429 deploy. No newer production measurement is attributable to PR #2435 yet because that PR is still open:

| Route | Device | PSI Perf | Lab LCP | Lab FCP | Lab TBT | Lab CLS | SEO |
|---|---:|---:|---:|---:|---:|---:|---:|
| Home | Mobile | 97 | 2402ms | 1052ms | 21ms | 0 | 100 |
| Home | Desktop | 97 | 761ms | 281ms | 23ms | 0 | 100 |
| PDP TriFold | Mobile | 89 | 3451ms | 1201ms | 28ms | 0.076 | 100 |
| PDP TriFold | Desktop | 98 | 863ms | 361ms | 66ms | 0.068 | 100 |

Later script runs showed normal lab variance:

| Date/run | Route | Source | Mobile LCP | TBT | CLS/notes |
|---|---|---|---:|---:|---|
| 2026-06-11 earlier | Home | PSI | 3451ms | 44ms | CLS 0 |
| 2026-06-11 earlier | PDP TriFold | PSI | 3901ms | 27ms | CLS 0.076 |
| 2026-06-11 earlier | Home | DebugBear | 1431ms | 497ms | CLS raw metric was 0; old summary omitted zero |
| 2026-06-11 earlier | PDP TriFold | DebugBear | 3580ms | 271ms | CLS raw metric was 0; old summary omitted zero |
| 2026-06-11 validation | Home | PSI | 3377ms | 0ms | CLS 0 |
| 2026-06-11 validation | PDP TriFold | PSI | 3451ms | 61ms | CLS 0.076 |
| 2026-06-11 validation | Home | DebugBear | 1556ms | 454ms | CLS 0 |
| 2026-06-11 validation | PDP TriFold | DebugBear | 2918ms | 416ms | CLS 0 |

The validation run saved raw artifacts to `/tmp/baci-ogabassey-audits-validation` with audit prefix `2026-06-11T21-48-18-965Z`. DebugBear quick-test API rows currently do not include Lighthouse category scores, so the script leaves `perf/a11y/bp/seo` as `-` for DebugBear while preserving metric values such as zero CLS.

Interpretation:

- Home is close in lab and sometimes already good; field data will lag because it is a 28-day CrUX window.
- PDP mobile remains the main lab problem. Treat PDP mobile LCP as the next performance bottleneck.
- CLS is not the main current lab issue; avoid layout-risky changes.

### CrUX field data

CrUX collection period: `2026-05-13` to `2026-06-09`.

| Scope | Form factor | p75 LCP | p75 INP | p75 CLS | p75 FCP | p75 TTFB |
|---|---|---:|---:|---:|---:|---:|
| Origin | Phone | 4741ms | 262ms | 0.13 | 4221ms | 1443ms |
| Origin | Desktop | 3943ms | 144ms | 0.08 | 2604ms | 698ms |
| Home URL | Phone | 4869ms | 393ms | 0.31 | 4495ms | 1576ms |

PDP URL-level CrUX data is not available; PSI falls back to origin-level field data for the PDP.

## Tooling requirement

Use the repo script for repeatable home/PDP measurements:

```bash
DEBUGBEAR_API_KEY='XqHvwkN7AeLpsPMOgph004B8X' \
DEBUGBEAR_PROJECT_ID='101919' \
OGABASSEY_PDP_URL='https://ogabassey.com/smartphones/samsung-galaxy-z-trifold' \
pnpm --dir apps/web perf:ogabassey-critical-path
```

The old env pairing was stale:

- old key/project: `uc88...0nF8` + `100906`,
- current key/project: `XqHv...4B8X` + `101919`.

The DebugBear poll endpoint must use `/project/:projectId/quickTest/:id` when the create response omits an API poll link. PR #2433 implements this in the measurement script, but it is still open as of 2026-06-12 and must be merged before this behavior exists on `main`.

## Imported teardown verdict

The teardown’s core verdict remains valid: the PDP has correct macro context and a strong schema skeleton (`shippingDetails`, `returnPolicy`, `priceValidUntil`) wrapped around too little retrievable content, self-contradicting facts, and previously broken bot-path metadata.

Important evidence from the pasted plan:

- Text-to-code was low: about `1.6%`, roughly `2.2KB` visible text in a `143KB` document, with most of the doc made of Flight JSON.
- OgaBassey scored `28/46` versus Jumia `38/46` in the reviewer scorecard.
- Buyer query responsiveness was `3/8`.
- CLS was already near solved in lab.
- Lab PDP LCP was around `3.1s` before later fixes; current lab still shows PDP mobile above the `2.5s` good threshold.
- Field LCP/TTFB remain the larger delayed feedback loop.

## Verified showstoppers and current status

1. **Bot metadata failure** — Status: **fixed by PR #2429, keep regression checks.** Before the fix, bot/AI crawler HTML exposed key metadata only through streamed Flight data or not at all. The current architectural fix uses the Next metadata HTML-limited-bot path rather than disabling metadata streaming globally.
2. **Knowledge-based trust contradictions** — Status: **partially fixed in PR #2435, pending merge.** Stale absolute-price sentences are stripped from PDP metadata/JSON-LD/visible payloads, fake zero-review rating display is suppressed, and invalid custom aggregate ratings are removed. Remaining S3 work: catalog/data variant image/color contradictions, still-reproducible price/FAB overlap, and stored-description data hygiene.
3. **usebaci.com canonical leak** — Status: **fixed for legacy PDP fallbacks by PR #2434, keep production regression checks.** `/products/<slug>` and `/product/<slug>` platform fallback behavior is no longer the next critical PR. Reopen only if raw production HTML still exposes indexable platform-domain PDP canonicals.
4. **Reviews backwards** — Status: **open.** PR #2435 adds guardrails so invalid/fake aggregate ratings do not leak, but approved review stats/reviews are still not wired into the canonical category PDP route. Emit `aggregateRating`/`review` only when valid approved review count is greater than zero and matching visible review content exists.
5. **Heading vector has weak micro-intent coverage** — Status: **open.** Add server-rendered buyer-decision sections only after canonical/trust/entity hygiene.
6. **Initial HTML has weak crawl paths** — Status: **open.** Related links, footer links, FAQ wiring, and category crawl cost need follow-up.

## Phase 0 — verify, measure, avoid overlap

Status: **ongoing before every PR. Measurement tooling repair is in PR #2433 and still needs merge/update from `main`.**

1. Fetch `origin/main` and inspect open PRs to avoid colliding with the other active agent.
2. Confirm recently merged performance commits are deployed before attributing wins or regressions.
3. Run the critical-path script against home and one representative PDP.
4. Use the noise gate: do not claim performance wins below about `600ms` LCP or `0.02` CLS unless repeated measurements prove it.
5. Keep raw artifacts under `output/audits/`; do not commit them unless explicitly requested.
6. Resolve why server-rendered related-product sections produce zero live initial-HTML links before expanding S6 scope.

## Phase 1 — semantic/SEO PRs

### S1. Bot metadata delivery

Status: **done, monitor.**

Acceptance:

- GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, Claude-User, PerplexityBot, Perplexity-User, Meta-ExternalAgent, Googlebot, and Twitterbot receive parseable product metadata in `<head>`.
- Ordinary human/browser traffic keeps the streaming metadata path.
- If production cache variants regress, debug the cache variant mechanism first. Observe `proxy.ts` only unless the user explicitly approves a protected-file diff.

Files to monitor:

- `apps/web/src/config/storefront-metadata-cache-bots.ts`
- `apps/web/src/app/(storefront)/[slug]/layout.tsx`
- `apps/web/src/proxy.ts` — observe only without approval.

### S2. Fix usebaci.com canonical leak and robots inconsistency

Status: **merged by PR #2434; monitor with raw production HTML checks.**

Goal:

- Stop `/products/<slug>` and `/product/<slug>` on `usebaci.com` from emitting misleading platform-origin canonicals.
- Standardize noindex behavior on platform leak routes while preserving merchant canonical routes.
- Prefer `noindex,follow` for leak shells unless current repo intent proves otherwise, so discovery can still flow without indexing the duplicate shell.

Progress:

- PR #2434 (`fix(web): noindex legacy storefront PDP fallbacks`) merged on 2026-06-11.
- Keep this phase in monitor mode: verify production raw HTML for representative legacy fallbacks, then only reopen if platform-domain canonicals or inconsistent robots still reproduce.

Likely files:

- `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/products/[productSlug]/page.tsx`
- `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/product/[productSlug]/page.tsx`
- Layout-level metadata defaults that emit the platform origin.

Why before content expansion:

- Canonical consolidation is prerequisite entity hygiene. More content on the canonical PDP is less valuable if alternate shells leak confusing canonical/robots signals.

### S3. Kill PDP trust contradictions

Status: **in review in PR #2435; finish review follow-up before starting S4/S5/S6.**

Scope:

- Render-time guard for stale absolute-price sentences such as `Current listed price is NGN X`; substitute or omit based on live min/max variant price.
- Data hygiene follow-up: regenerate stored descriptions without volatile absolute prices.
- Suppress filled-star UI until `review_count > 0`.
- Fix variant color/image contradictions if code-owned; flag catalog data repairs separately when data-owned.
- Fix visible price/FAB overlap if still reproducible.

Progress in PR #2435:

- Implemented `stripVolatileProductPriceSentences` and applied it to PDP metadata, JSON-LD/custom schema descriptions, hidden summary/body payloads, and cart payloads.
- Added regressions for stale price copy, HTML-wrapped stale price text, inline stale price fragments, `ratingCount > 0` with `reviewCount: 0`, and out-of-range custom `ratingValue`.
- Hardened custom `aggregateRating` validation against zero counts and out-of-range 1-5 scale values.
- Suppressed dishonest filled-star/aggregate-rating output when no valid reviews/ratings exist.
- Remaining review item before merge: guard `sanitizeCustomProductSchemaMarkup` when `sanitizeSchemaMarkup` returns nullish/non-object data.
- Remaining S3 after merge: catalog/data variant image/color contradictions, possible price/FAB overlap if still reproducible, and a stored-description cleanup job.

Likely files:

- `apps/web/src/lib/seo-utils.ts`
- `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx`
- `apps/web/src/components/storefront/ogabassey/pdp/critical-product.tsx`
- cached product LCP/variant selection in `apps/web/src/lib/cached-data.ts` as a data source only.

Reason:

- Semantic SEO depends on source consistency. Contradictory facts weaken trust more than missing Lighthouse points.

### S4. Ratings and reviews on the canonical route

Status: **open. PR #2435 only adds rating guardrails; it does not implement canonical-route review wiring.**

Scope:

- Port approved review stats/reviews to the canonical category PDP route.
- Emit `aggregateRating` and `review` only when count is greater than zero and visible review content matches.
- Keep zero-review products honest.

Likely files:

- cached review helpers in `apps/web/src/lib/cached-data.ts`
- canonical PDP JSON-LD emission
- `apps/web/src/lib/seo-utils.ts`

### S5. Entity attribute repairs

Status: **major, split code vs data.**

Code-owned:

- Stop hardcoding empty brand/GTIN/MPN where real fields exist.
- Use product Open Graph type correctly.
- Dedupe duplicate `additionalProperty` keys.

Data-owned:

- Populate GTIN/MPN where merchant data exists.
- Fix TriFold variant images; all variants sharing a wrong-product asset is catalog/data trust debt if confirmed live.

Likely files:

- `apps/web/src/lib/legacy-product-mapper.ts`
- `apps/web/src/lib/storefront-product-social-metadata.ts`
- `apps/web/src/lib/seo-utils.ts`

### S6. Server-render buyer-decision micro-contexts and heading vector

Status: **biggest semantic upside; do after S2-S5.**

Target heading/entity vector:

1. `<h1>` product name.
2. `<h2><Product> Price in Nigeria</h2>` with variant-aware price table.
3. `<h2>Specifications</h2>` from `product_key_specs`.
4. `<h2>Buy on Installment</h2>` for supported BNPL providers.
5. `<h2>Delivery & Warranty</h2>` from shipping/return policy data.
6. `<h2>Reviews</h2>` with honest empty state or approved review summary.
7. `<h2><Product> vs <named rival></h2>` when safe.
8. FAQ only when real FAQ items are selected.
9. Related products and footer links server-rendered in initial HTML.

Guardrails:

- Preserve CLS.
- Watch HTML/RSC payload size.
- Split into multiple PRs if the first diff grows too large.
- Do not create thin/doorway compare or spec pages.

Likely files:

- canonical PDP semantic sections
- `apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.tsx`
- PDP deferred detail island
- product runtime FAQ/review wiring.

## Phase 2 — performance residue after semantic blockers

Status: **after semantic blockers, unless PDP LCP regresses.**

Likely tasks:

1. PDP-scoped `cdn.ogabassey.com` preconnect from static head if trace still proves a cold CDN connection on the LCP image. Scope it to PDP to avoid homepage unused-preconnect warnings.
2. PDP LCP image priority/shape audit after current agent work settles.
3. Flight payload reduction only after prop-level evidence. PDP and category docs are large because of RSC/Flight JSON; category pages may be the worst crawl-cost surface.
4. Do not do more critical-CSS byte trimming unless a trace proves it is the bottleneck.

## Phase 3 — gated field-TTFB experiment

Status: **requires explicit approval before any `proxy.ts` diff.**

Goal:

- Investigate regional cache hit ratio and no-store behavior behind field TTFB p75 around `1443-1576ms` on phone.
- Determine whether metadata cache bucket fragmentation or `no-store` policy is harming Nigerian field traffic.
- Use preview deployment/replay before any production cache-control change.

Possible path:

1. Check edge hit ratio by region.
2. Verify Supabase project region and Vercel function region. If Supabase is US-East, moving functions away could worsen DB round trips; caching may be the correct lever instead.
3. Preview `s-maxage` experiment scoped narrowly to OgaBassey homepage/PDP.
4. Reproduce/refute the Next 16 resume mismatch that previously motivated `no-store`.
5. Request explicit approval for a minimal `proxy.ts` diff and colocated tests only if evidence supports it.

Expected field target if successful:

- Field TTFB p75 below roughly `800ms`, feeding field FCP/LCP improvements.

## Phase 4 — homepage LCP residuals

Status: **deprioritized unless home lab regresses.**

Current view:

- Home mobile lab is near practical floor compared with PDP.
- Remaining largest homepage lever is field TTFB/cache behavior, which belongs to Phase 3.

Ranked levers:

1. **L1 field:** Phase 3 document caching.
2. **L2 field:** region investigation only after Supabase/Vercel geography is known.
3. **L3 lab:** targeted inline of only home-critical CSS into the PPR static shell. Do not use global `experimental.inlineCss`; prior attempts inflated streamed HTML and duplicated Tailwind chunks.
4. **L4 lab minor:** Early Hints / earlier Link headers only inside the gated proxy/cache flow.

Anti-lever:

- No further critical-CSS byte trimming without trace evidence.

## Phase 5 — site-wide semantic and structural authority roadmap

Goal: move toward tech-commerce authority in Nigeria by expanding semantic coverage without doorway/thin-content patterns.

### A. Structural prerequisites

- **A1. Organization + WebSite/SearchAction schema site-wide.** `generateOrganizationSchema` exists; wire it on storefront layout/home with logo, sameAs, and NAP where valid.
- **A2. Server-render footer links.** Existing footer components should produce initial-HTML crawl paths instead of zero footer links.
- **A3. S1 bot metadata visibility.** Already handled, but keep regression checks because everything depends on crawler-visible metadata.
- **A4. Category crawl cost.** Category documents are large; verify pagination and crawlable hrefs before deeper content work.

### B. Content surfaces, in order

- **B1. Per-model spec sections as visible crawlable content.** Fold into S6 using `product_key_specs` already present in structured data.
- **B2. Model-vs-model compare pages.** Generate only for top-N useful pairs, not all combinations. Link each compare page to both PDPs and the category.
- **B3. Best `<category>` under NGN X pages.** Programmatic from live catalog plus short editorial intro, limited to real inventory and a small set of price buckets.
- **B4. Brand hub pages.** Crawlable brand-filtered category pages with intro copy, top models, and brand guides.
- **B5. Blog E-E-A-T upgrade.** Author entities, author pages, reviewedBy on buying guides; extend existing blog/news machinery instead of rebuilding.
- **B6. Price history.** Defer until a price snapshot table exists.

### C. Do not build

- City/location doorway pages without real local signals.
- Compare pages for all product pairs.
- Standalone spec-page URLs duplicating PDP content unless later evidence proves PDP/spec cannibalization.
- Bulk AI-generated blog content.

### D. Measurement for authority work

- Search Console impressions/clicks by query class: price, specs, vs, best-under.
- Rich-result eligibility after S4/A1.
- Category crawl stats after A4.
- Do not measure authority roadmap success primarily with PSI.

## Stop rules

- Per-PR performance noise gate: do not claim wins below `600ms` LCP or `0.02` CLS on repeated runs.
- Two sub-gate PRs on one metric axis means halt that axis and re-evaluate.
- Semantic work is measured through raw HTML visibility, Search Console, rich-result eligibility, and query-class coverage, not only PSI.
- CrUX field checkpoint is delayed by the 28-day rolling window; do not expect immediate field movement from a same-day merge.
- Lab floors to maintain: home mobile PSI at least low/mid-90s and PDP mobile LCP trending toward `<= 3.0s` before deeper field work.
- Field target: origin phone LCP p75 `<= 3.0-3.5s`, CLS `<= 0.1`; below that may require Phase 3 caching/TTFB work.

## What not to touch without evidence or approval

- CLS-clean PDP layout geometry.
- JSON-LD `shippingDetails`, `returnPolicy`, and `priceValidUntil` builders unless fixing a verified semantic mismatch.
- canonical-route redirect discipline.
- sitemap hygiene and robots.txt unless tied to a verified canonical/crawl bug.
- the LCP image pipeline itself without a trace proving it remains the bottleneck.
- blog topical bridge; extend, do not rebuild.
- global critical-CSS/preflight changes.
- `proxy.ts` outside the explicitly approved gated flow.

## Verification checklist per PR

- Fetch/rebase from `origin/main` and inspect active PRs for overlap. Current active PRs to consider as of 2026-06-12: #2433 measurement tooling and #2435 PDP trust signals.
- Targeted tests for changed logic.
- `pnpm turbo lint --filter=@baci/web`.
- `pnpm --dir apps/web exec tsc --noEmit --pretty false`.
- Relevant route/browser smoke where UI changes.
- Raw-HTML checks for bot/browser UAs where metadata or semantic HTML changes.
- JSON-LD/Rich Results validation for structured data changes.
- Post-merge production PSI/DebugBear for performance-sensitive changes.

## Key artifacts referenced by the teardown

These are local/transient audit artifacts from the reviewer run and may not exist on every machine/session:

- CWV audit: `/tmp/audit/*.txt`
- PDP teardown: `/tmp/pdp-review/*.txt`, including `critique-full.txt`
- Raw PDP HTML/JSON-LD: `/tmp/pdp-audit/*`

