# Review: Home-LCP TTFB Findings Chain — Independent Verification (2026-07-23)

**Reviewer:** read-only verification pass (no code/config changed).
**Subject:** the 9-finding chain concluding that ogabassey.com home LCP (~4.7 s p75) is driven by
ad-click landings whose tracking query params bypass the Cloudflare edge cache, and the proposed
CF cache-key fix.
**Method:** re-ran CF GraphQL analytics (free-plan window), pulled the live cache ruleset, ran
fresh curl probes with random param values, traced the home route + attribution code, and re-ran
the PostHog HogQL segmentation/decomposition queries (env pulled to scratchpad, deleted after use).

---

## Verdict table

| # | Finding | Verdict |
|---|---------|---------|
| 1 | Segmentation: slow tail = Android+Chrome, NG; "identical images ⇒ not image-bytes" | **AMEND** — numbers reproduce; the iOS comparison is confounded and the "identical images" leap is unsound; the *conclusion* (not image-bytes) survives via subparts |
| 2 | Decomposition: TTFB 43% dominant, "not JS" | **CONFIRM numbers / AMEND interpretation** — TTFB is mostly network physics, not recoverable by caching; renderDelay is the largest *addressable* share |
| 3 | JS bundle already lean; cut-list ~20–25 KB | **CONFIRM** (real bundle-analyzer data; sound method) |
| 4 | Edge facts (HIT on clean /, cdn-cache-control, dub1, h3) | **CONFIRM** (all re-verified, incl. `alt-svc: h3`) |
| 5 | 67% of NG home requests not edge-served → origin round trips | **AMEND (heavily)** — bucket is polluted; RSC requests and non-pageview noise dominate the non-hit share |
| 6 | Cache Reserve ruled out | **CONFIRM conclusion** (partly for different reasons) |
| 7 | Root cause: ad-click landings with tracking params → DYNAMIC → Dublin RTT | **REFUTE** — mechanism now fully explained, but the traffic premise is false (~0.5% of home landings carry marketing params) |
| 8 | Cache rules inventory; `ignore_query_strings_order` note | **AMEND** — missed the operative predicate `http.request.uri.query eq ""`; the cache-key note is a red herring |
| 9 | Proposed fix: strip marketing params from home cache key | **SAFE but ~zero-impact** for current traffic; must NOT be applied to the whole existing rule (listing pages read `searchParams`) |

---

## A. Soundness of each finding

### A(i) Finding 1 — the iOS comparison is confounded (challenge upheld)

Re-ran deduped (argMax by `properties.id`) home-path LCP, post-2026-07-13, ogabassey host:

| os | n | p75 LCP | p75 LCP-subpart ttfb | p75 standalone TTFB metric |
|----|---|---------|----------------------|-----------------------------|
| Android | 367 | 5308 | 1608 | 1568 |
| iOS | 96 | 2342 | **0** | **315** |
| Windows | 85 | 5064 | 1181 | 1215 |
| Mac OS X | 26 | 2937 | 349 | 343 |

- **iOS LCP-subpart ttfb is 0 even for `navigationType='navigate'` (n=91)** — physically
  impossible for a real network navigation. The subpart attribution is an artifact on WebKit
  (prop present but zero). Meanwhile the *standalone* TTFB metric shows iOS at a real 315 ms p75
  vs Android 1568 ms — the iOS cohort is on ~5× faster networks. So "identical images, Android
  2.2× slower ⇒ not image-bytes" compares different networks and different LCP engine semantics
  (WebKit vs Chromium LCP are not comparable), not the same page on two devices. **The leap does
  not hold.**
- The *conclusion* (image bytes are not the lever) is still supported, but by the subparts:
  loadDuration is ~11% of slow-bucket LCP (see A-2).
- **"Concentrated in Nigeria" is overstated.** NG is 51% of Android home LCP events; GB (n=73),
  NL (n=72), FR (n=15) have p75 LCP 4.5–4.8 s with p75 ttfb 1484–1543 ms — statistically the
  same as NG (1623 ms). Either these are African users behind EU proxy/VPN egress
  (Opera/data-saver/WARP), or genuinely EU users who are also slow. Either way,
  **distance-to-Dublin does not discriminate the slow cohort** — GB→Dublin is ~15 ms RTT yet GB
  Android TTFB ≈ NG Android TTFB. Windows p75 5064 further shows it is not an Android-CPU story;
  it is a *network cohort* story.

### A(ii) Finding 2 — numbers confirmed, interpretation amended

Reproduced (Android, slow >4 s bucket, means): LCP 8115, **ttfb 3493** (claimed 3507),
**renderDelay 2896** (claimed 2959), loadDelay+loadDuration 1726 (claimed ~1664). Fast bucket
ttfb mean 637.

Amendments:
1. Conditioning on LCP>4 s mechanically selects high-TTFB (slow-network) samples; the
   "slow-vs-fast delta is TTFB" is partly tautological, not proof TTFB is a *lever*.
2. TTFB here includes DNS + TCP/QUIC + TLS + radio latency on NG mobile links. An edge HIT saves
   only the CF-PoP→origin fetch leg (~0.3–1 s at p75 when it applies), never the handshakes.
   Even a 100% edge-hit world leaves most of that 3.5 s standing for this cohort.
3. "Not JS" is too strong: renderDelay (36% of slow LCP; p75 2547 ms for NG Android) is the
   largest subpart that is actually under our control (critical CSS via
   `OgabasseyHomeStyleLoader`, fonts, hydration around `HeroMobileCarousel` — the LCP element
   lives inside a `'use client'` island).

### A(iii) Finding 5 — the 41%/26% buckets do not mean what the finding says

Re-ran CF GraphQL (free plan, 23 h, host=ogabassey.com, path="/"):
NG = hit 31%, dynamic 41%, none 26%, updating 2%, miss 0% — **numbers reproduce**. But the
composition breaks the conclusion:

- Splitting by status/method (all countries): `('none', 204, 'PUT')` = **1570 requests** — the
  single largest "none" contributor. A probe `PUT /` today returns **405**, so this is
  bot/monitor noise, not pageviews. Rest of "none": 301 redirects (www/http) and 499 client
  aborts. **The "none" bucket says nothing about cacheability.**
- **RSC requests are inside "dynamic":** probed `GET /` with an `rsc: 1` header → the
  RSC-bypass rule (action `cache: false`) returns **`cf-cache-status: DYNAMIC`** (and zero
  BYPASS rows exist in analytics). Every SPA navigation/prefetch to home from inside the site
  emits one of these. They are subresource fetches, not landings, and they are bypassed *by
  design* (2026-07-10 poisoning fix).
- miss=0% is explained by the rule predicate (below): query'd URLs are *ineligible*, so they
  can never register as "miss".

Real GET/200 traffic: dynamic 2792 vs hit 2490 (+165 updating) — and the dynamic side is
RSC + logged-in-cookie bypasses + query'd URLs in unknown proportion (free plan blocks
`clientRequestQuery` and `edgeResponseContentTypeName`, both verified rejected). Given A(iv)
below, the query'd share must be small. **The claim "~67% of NG home *landings* round-trip to
Dublin" is not supported; the HTML-landing hit rate is materially higher than 33%.**

### A(iv) Finding 7 — mechanism found, hypothesis refuted

**The mechanism (fully explained, no coincidences):**

1. The live HTML cache rule (`cache_public_ogabassey_storefront_html`, id
   `36bc539f83454514b8933fe866c7c1be`, v11) contains **`(http.request.uri.query eq "")`** in its
   *expression*. Any query string ⇒ rule doesn't match ⇒ HTML falls to CF default (HTML not
   cached) ⇒ **DYNAMIC**. It is an *eligibility* failure, not cache-key fragmentation —
   `ignore_query_strings_order` (finding 8) never comes into play.
2. **fbclid/gclid/ttclid/msclkid HIT because Cloudflare removes known click-ID params before
   rule evaluation and cache lookup.** Proof: fresh *random* values
   (`?fbclid=ZX…`, `?gclid=GG…`, `?ttclid=…`, `?msclkid=…`) returned `cf-cache-status: HIT`
   with the **same `Age` sequence (1354–1361 s, continuing the clean-URL entry's 1344 s) and the
   identical stored `x-vercel-id` (`cpt1::dub1::gd4wz-1784824923151-…`)** as clean `/`. A
   never-before-seen value can only HIT if the param was stripped pre-lookup — and since the
   rule requires `query eq ""` to be eligible at all, stripping must occur *before expression
   matching* too. `utm_*`, `ref`, and arbitrary params are not on CF's built-in list ⇒ DYNAMIC.
   (`?fbclid=…&utm_source=…` ⇒ DYNAMIC: the utm survives stripping and breaks eligibility —
   consistent.)
3. The origin is *not* the differentiator: query'd probes returned
   `cdn-cache-control: max-age=3600` and **`x-vercel-cache: HIT`** (age ~975 s) — Vercel serves
   the same ISR page regardless of query. So even today, a query'd NG landing pays only the
   CF-PoP→Vercel(dub1) leg, not a function render.

**The refutation (traffic premise fails):** posthog-js stamps campaign params
(`utm_source`, `fbclid`, `gclid`, `ttclid`, …) as event properties *independently* of the URL
redaction (`redactUrlQuery` strips `$current_url` query, but `sanitizePropertyValue` passes
campaign props through — verified in `client-config.ts`, and non-zero counts prove the pipeline
works). Post-2026-07-13 home pageviews:

| os | pageviews | utm_source | fbclid | gclid | ttclid |
|----|-----------|-----------|--------|-------|--------|
| Android | 951 | **3** | **2** | 0 | 0 |
| iOS | 316 | 5 | 10 | 0 | 0 |
| Windows | 217 | 0 | 2 | 0 | 0 |

The only utm_source value present is `chatgpt.com` (n=9). **Marketing-param'd home landings are
~0.5% of traffic** — they cannot be the Android slow tail, and "Nigeria+Android+Chrome+slow =
paid-ad landing" is false on current data. (Either ads are paused in this window, ad links land
on non-home paths, or ad URLs carry only click-IDs — which already HIT.) Note: the
`web_vitals`/`$pageview` URL query is redacted client-side, so the original chain *could not
have* verified its premise from PostHog URLs — this step was ship-and-assume.

### Finding 3 — confirmed
`docs/perf/home-js-budget-cutlist-2026-07-23.md` is based on a real
`next experimental-analyze` module graph; the "already lean / ~20–25 KB cut-list" conclusion is
sound. Its *framing* ("iOS fine ⇒ CPU/JS") inherits the F1 confound, but its measurements stand.
Its own TL;DR already points at hydration cost + network — consistent with this review.

### Finding 4 — confirmed
Clean `/` HITs; `cdn-cache-control: max-age=3600, stale-while-revalidate=86400`; origin `dub1`;
`alt-svc: h3` present.

### Finding 6 — conclusion confirmed
Cache Reserve is irrelevant here (also a paid feature). But "dynamic/none = deliberately
uncached" is only right for the RSC-bypass and query-ineligible slices; the "none" bucket is
mostly non-pageview noise (A-iii), not deliberate anything.

---

## B. Correctness risk of the proposed fix

- **Home render is query-independent:** no `searchParams` usage anywhere in
  `apps/web/src/app/(storefront)/[slug]/(home)/` (page, layout, content components; the page
  receives only `params`). Origin behavior confirms it (same ISR payload for any query probe).
- **Attribution is unaffected:** click-ID/UTM capture is client-side
  (`components/storefront/ad-attribution-capture.tsx` inline script → POST `/api/attr` →
  `baci_*` cookies; `lib/ad-tracking-cookies.ts`). The browser URL keeps its params on an edge
  HIT; `/api/attr` is not cached. Nothing server-side reads utm/click-IDs during the home HTML
  request. The rule's cookie exclusions (auth/preview) are untouched.
- **Cache-deception armor / RSC interaction:** armor stays on; the RSC-bypass rule matches on
  headers and is the **last** rule (last-match wins in CF cache rules), so RSC requests keep
  bypassing regardless of key changes. It must remain last.
- **THE REAL RISK the proposal missed:** the existing HTML rule also covers listing paths
  (`/laptops`, `/smartphones`, `/products`, …) whose pages **do** read `searchParams`
  (pagination/sort — e.g. `(catalog)/(listing)/[category]/page.tsx`,
  `(listing)/products/page.tsx`). Applying "ignore/strip query" to the **existing rule** would
  serve page-1 HTML for `/laptops?page=2`. **Any change must be a new rule scoped to
  `http.request.uri.path eq "/"` only** (optionally blog home later, after the same audit).

---

## C. Config vs code

Pure **Cloudflare Cache Rule** change (a new zone ruleset entry). No code change, **no
`proxy.ts` change** (protected file untouched). Caveats: query-string custom cache keys are
documented as available on all plans (host/header/cookie custom keys are Enterprise) — confirm
the API accepts it on this free zone at apply time; and the new rule must be inserted *before*
`bypass_nextjs_rsc_prefetch_requests` in rule order.

Reviewed (not recommended as an LCP fix — see D) rule sketch, mirroring the existing HTML rule's
settings:

```json
{
  "action": "set_cache_settings",
  "description": "Home-only: cache ogabassey / ignoring query params (render verified query-independent 2026-07-23)",
  "expression": "(http.host in {\"ogabassey.com\" \"www.ogabassey.com\"}) and (http.request.method eq \"GET\") and (http.request.uri.path eq \"/\") and not (http.cookie contains \"-auth-token\") and not (http.cookie contains \"__prerender_bypass\") and not (http.cookie contains \"__next_preview_data\")",
  "action_parameters": {
    "cache": true,
    "browser_ttl": { "mode": "respect_origin" },
    "edge_ttl": { "mode": "respect_origin",
      "status_code_ttl": [
        { "status_code_range": { "from": 300, "to": 399 }, "value": 60 },
        { "status_code_range": { "from": 400, "to": 499 }, "value": 0 },
        { "status_code_range": { "from": 500, "to": 599 }, "value": -1 } ] },
    "cache_key": {
      "cache_deception_armor": true,
      "custom_key": { "query_string": { "exclude": { "all": true } } }
    }
  }
}
```

("Exclude all" is defensible for `/` only because the render ignores every param; if a narrower
posture is preferred, use an exclude *list* — utm_source, utm_medium, utm_campaign, utm_term,
utm_content, utm_id, ref, igshid, mibextid, srsltid — click-IDs are already stripped by CF.
Validate the exact `query_string` schema against current API docs at apply time.)

---

## D. Verdict and recommended next step

**Most likely true root cause of the flat ~4.7 s p75:** a slow-network cohort (NG mobile +
proxy-egress users, on Chromium where LCP is actually measured), whose p75 LCP decomposes as
~1.6 s TTFB (connection setup + radio; only a minority of HTML landings actually miss the edge)
+ ~2.0–2.5 s renderDelay (critical-path CSS/fonts/hydration before the hero paints) + ~0.6 s
image fetch. There is **no single config-level smoking gun**; the query-param/DYNAMIC story is a
real inefficiency but affects ~0.5% of current home landings.

**Recommended next step (concrete, minimal):**
1. **Do not ship finding 9 as the LCP fix** — expected p75 movement on current traffic is ~nil.
   Optionally ship the home-scoped rule above as cheap forward-insurance for future ad bursts
   (correctness-verified), with explicitly zero expected LCP impact. Never modify the existing
   multi-path rule's key, and keep the RSC-bypass rule last.
2. **Attack renderDelay next (the largest addressable subpart):** determine what delays hero
   paint ~2–2.9 s *after* the image bytes arrive on slow Androids — deferred home CSS
   (`OgabasseyHomeStyleLoader`), font loading, or the `HeroMobileCarousel` client island.
   A throttled-device trace answering "what is the paint blocked on when the LCP image is
   already loaded?" is the single highest-information next measurement.
3. Fix the measurement hygiene that produced this chain: treat iOS/WebKit LCP as
   non-comparable; exclude PUT/3xx/499 and remember RSC lands in "dynamic" when reading CF
   analytics for "/"; and if the ad thesis matters commercially, verify what params the actual
   ad URLs carry (Ads Manager templates) — PostHog URLs cannot show it (query redacted).

**Ship-and-assume flags in the original chain:** (a) 41% dynamic → "ad landings" without any
query-string evidence (the decisive premise was never measured; it fails); (b) "identical
images ⇒ not image-bytes" via a network-confounded iOS cohort with a broken ttfb subpart;
(c) treating all path="/" requests as landings (RSC + PUT/redirect noise); (d) attributing
fbclid/gclid HITs to the zone's cache-key config (`ignore_query_strings_order` sorts — the HITs
come from CF's built-in click-ID stripping plus the unnoticed `query eq ""` predicate).

---

*Verification artifacts: live ruleset v18 (rule ids `36bc539f…` HTML, `c57d98af…` RSC bypass);
curl probes 2026-07-23 ~17:00 UTC; CF GraphQL 23 h window ending 2026-07-23T17:05Z; PostHog
HogQL post-2026-07-13 window, ogabassey host, pathname='/', deduped by metric id. Production
env file pulled to scratchpad for PostHog access was deleted after use; no secrets printed.*
