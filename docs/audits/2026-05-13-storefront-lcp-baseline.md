# Storefront LCP Baseline - 2026-05-13

## Finding 2: PDP banner image discovery delay

This note is part of the OgaBassey storefront LCP audit series; Finding 1 covered the home hero preload path in the earlier Core Web Vitals loop.

PSI lab capture reported the OgaBassey PDP desktop LCP element as the Flash Sale banner image.

| Observation | Baseline |
|---|---:|
| PDP desktop LCP observation | 2769 ms |
| Banner resource discovery delay observation | 3103 ms |
| TBT | 1490 ms |

The Flash Sale image is rendered by `BannerCarousel`, which is imported with `dynamic(..., { ssr: false })` and gated behind post-hydration desktop detection in `ProductDetailsPage`, so the image is not discoverable from initial HTML.

Note: the LCP and resource-delay values above came from earlier audit observations and should not be treated as one additive Lighthouse breakdown. Re-capture a same-run PSI baseline before comparing subpart deltas.

## Same-run baseline before PDP banner preload

Date: 2026-05-13
Source: PSI API, desktop, production URL before this PR deployed.

The first PSI API attempt failed with `FAILED_DOCUMENT_REQUEST` / `net::ERR_ABORTED`. A direct production check immediately after the failure returned `HTTP/2 200`, `content-type: text/html; charset=utf-8`, `x-matched-path: /[slug]/[category]/[productSlug]`, and streamed the expected HTML document prefix for the PDP URL.

Retry output:

```json
{
  "url": "https://ogabassey.com/lenovo/lenovo-legion-pro-9-16irx9-rtx-4090",
  "strategy": "desktop",
  "fetchedAt": "2026-05-13T17:39:06.126Z",
  "error": {
    "code": 400,
    "message": "Lighthouse returned error: FAILED_DOCUMENT_REQUEST. Lighthouse was unable to reliably load the page you requested. Make sure you are testing the correct URL and that the server is properly responding to all requests. (Details: net::ERR_ABORTED)"
  }
}
```

Proceeding with the implementation because the target URL responds normally outside PSI; post-merge measurement must retry PSI and verify the production preload HTML before judging the result.

## Post-merge tracking

| Date | Change | Page | Strategy | Perf | A11y | BP | SEO | LCP | FCP | TBT | CLS | Notes |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 2026-05-15 | PR #1671 deployed (`9882bb8451a168425bb5ef7001e511602c076d32`) | OgaBassey home | mobile | 87 | - | - | 100 | 3376 ms | 1201 ms | 76 ms | 0.001 | LCP request is discoverable/eager/high priority, but appears via RSC `:HL` stream data rather than a native initial-head link; resource load delay remains about 2080 ms. PR #1674 keeps the assets on public URLs so the existing viewport-scoped ReactDOM preloads match the image request; it intentionally avoids UA-selected HTTP `Link` variants because the rendered hero branch is viewport-driven. |
| 2026-05-15 | PR #1671 deployed (`9882bb8451a168425bb5ef7001e511602c076d32`) | OgaBassey home | desktop | 99 | - | - | 100 | 761 ms | 281 ms | 6 ms | 0.000 | Desktop home is healthy. |
| 2026-05-15 | PR #1671 deployed (`9882bb8451a168425bb5ef7001e511602c076d32`) | OgaBassey PDP | mobile | 84 | - | - | 100 | 3226 ms | 1201 ms | 358 ms | 0.072 | Improved from the prior 4824 ms plan baseline, but still over target; remaining bottleneck is main-thread JS work, not image discovery. |
| 2026-05-15 | PR #1671 deployed (`9882bb8451a168425bb5ef7001e511602c076d32`) | OgaBassey PDP | desktop | 68 | - | - | 100 | 1182 ms | 403 ms | 589 ms | 0.000 | LCP is now under target; TBT is noisy/high, partly from ad scripts and shared storefront JS. |
| 2026-05-17 | PR #1727 deployed (`5c577817f887597e91dddbb3b7dd530fa01536cd`) | OgaBassey home | mobile | 90-97 | - | - | 100 | 2551-3376 ms | 1201 ms | 33-59 ms | 0.001 | #1727 removed the invalid hand-built `next.config.ts` Link preload that pointed at a 404. Live HTML now has zero references to the bad `b344efbb` URL, and the remaining static-imported mobile/desktop hero AVIF preloads return `200 image/avif` with immutable caching. PSI LCP discovery passes, so the remaining home gap is render/resource delay around the Suspense fallback hero, not a missing hero image request. |
| 2026-05-17 | PR #1728 deployed (`cefa5f8461287a67f6ccdff7989b044288e33a92`) | OgaBassey home | mobile | 90 | - | - | 100 | 3376 ms | 1201 ms | 67 ms | 0.001 | #1728 made the mobile hero decode synchronously. Live HTML shows `decoding="sync"` on the streamed real hero image and PSI identifies that real `iPhone 17 Pro Max` image as LCP. LCP discovery still passes, but the mobile AVIF request starts at about 1555 ms, immediately after the document stream finishes; the next fix removes the mobile preload's viewport `media` condition so the tiny 2 KB mobile AVIF can be acted on in the earliest preload phase. |
| 2026-05-17 | PR #1729 deployed (`46331be1bc6b002e92789c8281f7abffee812b33`) | OgaBassey home | mobile | 96 | - | - | 100 | 2251 ms | 1201 ms | 37 ms | 0.001 | #1729 removed the mobile hero preload's viewport `media` condition while keeping the desktop preload scoped. Three consecutive PSI mobile runs were stable at LCP 2251 ms, so the home route now meets the 2500 ms target. |
| 2026-05-17 | PR #1729 deployed (`46331be1bc6b002e92789c8281f7abffee812b33`) | OgaBassey PDP | mobile | 91 | - | - | 100 | 3226 ms | 1201 ms | 116 ms | 0.072 | Canonical PDP URL: `https://ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090`. The LCP image is the primary product image, discovered early through the existing preload and fetched at high priority, but it still renders with `decoding="async"`. Next slice: make only that primary PDP LCP image decode synchronously, then re-measure before larger bundle work. |
| 2026-05-17 | PR #1733 deployed (`ff53ed37a27f4360b26a0e9cc68412bcf2da41d3`) | OgaBassey PDP | mobile | 86 | - | - | 100 | 4051 ms | 1201 ms | 100-250 ms | 0.000 | Live HTML confirmed the primary product image renders with `decoding="sync"`, `loading="eager"`, and `fetchPriority="high"`, but PSI worsened/noised instead of improving. Detailed PSI showed about 120 KiB unused JS, 38 KiB unused CSS, 1.9 s main-thread work, and 934 ms script evaluation. The next measured bottleneck is PDP client bundle/main-thread work, not image discovery. |
| 2026-05-17 | PR #1733 deployed (`ff53ed37a27f4360b26a0e9cc68412bcf2da41d3`) | OgaBassey PDP | desktop | 82 | - | - | 100 | 1691 ms | 321 ms | 271 ms | 0.045 | Desktop LCP remains under target, but TBT is close to the 300 ms guardrail. Keep subsequent PDP bundle trims narrow and verify desktop TBT does not regress. |
| 2026-05-19 | PR #1756 deployed in latest `main` (`e5d2e8a7cc9c6aa3cf12e687cead96d899e67dfd`) | OgaBassey home | mobile | 95-97 | - | - | 100 | 2401-2851 ms | 1201 ms | 69-79 ms | 0.001 | Home remains near the threshold: one confirmation run passed at 2401 ms and the immediately prior run measured 2851 ms. SEO, CLS, and TBT stayed healthy. Keep home in the regression set but continue prioritizing PDP. |
| 2026-05-19 | PR #1756 deployed in latest `main` (`e5d2e8a7cc9c6aa3cf12e687cead96d899e67dfd`) | OgaBassey PDP | mobile | 81-85 | - | - | 100 | 3976-4051 ms | 1201 ms | 148-216 ms | 0.000-0.072 | #1756 reduced mobile PDP unused JS to about 21-23 KiB and unused CSS to 0, but LCP stayed poor. The new dominant subpart is product-image resource load delay (~1256-1489 ms) plus element render delay (~542-784 ms). Live HTML showed the product image hint emitted as a late RSC `:HL[...]` record around byte 15 KB, after body/scripts, not as an early native `<link>`. |
| 2026-05-19 | PR #1756 deployed in latest `main` (`e5d2e8a7cc9c6aa3cf12e687cead96d899e67dfd`) | OgaBassey PDP | desktop | 91 | - | - | 100 | 916 ms | 343 ms | 197 ms | 0.000 | Desktop PDP remains healthy after #1756. The follow-up should not regress desktop TBT, which is now just under the 200 ms target. |
| 2026-05-19 | PR #1763 deployed (`fa2e087a0951f4cfd7f7c32a582b938cab14947c`), rechecked with `web-quality-skills` guidance | OgaBassey home | mobile | 95 | 100 | 100 | 100 | 2851 ms | 1201 ms | 29 ms | 0.001 | Still above the 2500 ms target, but much closer. LCP discovery passes; PSI reports a 415 ms resource-load delay and no render-blocking insight. |
| 2026-05-19 | PR #1763 deployed (`fa2e087a0951f4cfd7f7c32a582b938cab14947c`), rechecked with `web-quality-skills` guidance | OgaBassey home | desktop | 98 | 100 | 100 | 100 | 861 ms | 321 ms | 19 ms | 0.000 | Desktop remains good. |
| 2026-05-19 | PR #1763 deployed (`fa2e087a0951f4cfd7f7c32a582b938cab14947c`), rechecked with `web-quality-skills` guidance | OgaBassey PDP | mobile | 83 | 100 | 100 | 100 | 3976 ms | 1201 ms | 65 ms | 0.000 | Remaining primary blocker. LCP element is now the primary product image. LCP discovery passes, TBT is low, and unused JS is only about 21 KiB, but the LCP breakdown still shows about 2606 ms resource-load delay. |
| 2026-05-19 | PR #1763 deployed (`fa2e087a0951f4cfd7f7c32a582b938cab14947c`), rechecked with `web-quality-skills` guidance | OgaBassey PDP | desktop | 95 | 100 | 100 | 100 | 901 ms | 321 ms | 123 ms | 0.045 | Desktop PDP remains good. Google/DoubleClick ads account for most third-party main-thread time, but desktop TBT is still under the 300 ms budget. |
| 2026-05-20 | Post-PR #1790 audit on latest live production (`5fd9b8fd3426598cb970c669bef9ed1b497e37b6`; includes #1790 `5ac0f34a44b05df7b6e970b0a382a1f39cfe46c1`) | OgaBassey home | mobile | 100 | 96 | 100 | 100 | 1681 ms | 1360 ms | 28 ms | 0.001 | PSI was unavailable, so this row uses local Lighthouse 13.3.0. Home mobile now passes LCP/TBT/CLS/SEO. Remaining a11y issue is touch-target spacing where the mobile hero CTA overlaps the carousel dot controls. Browser timing with cache disabled measured FCP 2284 ms, LCP 2308 ms, CLS 0.000. |
| 2026-05-20 | Post-PR #1790 audit on latest live production (`5fd9b8fd3426598cb970c669bef9ed1b497e37b6`; includes #1790 `5ac0f34a44b05df7b6e970b0a382a1f39cfe46c1`) | OgaBassey home | desktop | 98 | 100 | 100 | 100 | 964 ms | 487 ms | 0 ms | 0.000 | Local Lighthouse 13.3.0. Home desktop remains healthy. Browser timing with cache disabled measured FCP 1504 ms, LCP 2344 ms, CLS 0.000. |
| 2026-05-20 | Post-PR #1790 audit on latest live production (`5fd9b8fd3426598cb970c669bef9ed1b497e37b6`; includes #1790 `5ac0f34a44b05df7b6e970b0a382a1f39cfe46c1`) | OgaBassey PDP | mobile | 87 | 100 | 100 | 92 | 4068 ms | 1293 ms | 62 ms | 0.000 | Local Lighthouse 13.3.0 still reports poor mobile PDP LCP, but #1790 changed the resource-discovery shape: the product image request is `isLinkPreload: true`, high priority, starts at 1228 ms, and finishes at 1393 ms while the document stream continues until 1922 ms. Direct Chrome timing with cache disabled measured FCP/LCP 1124 ms and product image preload start at 611 ms before document `responseEnd` 1043 ms. The next blocker is not another product-image hint. SEO is 92 because Lighthouse reports the PDP meta description missing even though browser DOM sees it, consistent with the streamed PDP metadata landing after the initial head. A11y also flags the sticky Add to Cart button because visible text `Add to Cart` is not included in `aria-label="Add this product to cart"`. |
| 2026-05-20 | Post-PR #1790 audit on latest live production (`5fd9b8fd3426598cb970c669bef9ed1b497e37b6`; includes #1790 `5ac0f34a44b05df7b6e970b0a382a1f39cfe46c1`) | OgaBassey PDP | desktop | 60 | 100 | 77 | 92 | 1349 ms | 413 ms | 1194 ms | 0.021 | Local Lighthouse 13.3.0. Product-image LCP discovery still passes and LCP is under target. The desktop lab regression is dominated by a 1323 ms long task attributed to the document plus Google/DoubleClick ad activity: third-party cookies, DevTools cookie issues, bfcache blocked by an ad iframe unload handler, a Poppins font-display warning, and 117 KiB unused JS mostly from `pubads_impl.js`. Direct Chrome timing was much lower (FCP 2120 ms, LCP 2136 ms, one 54 ms long task), so treat desktop ad/GPT cost as a separate best-practices/TBT investigation after fixing PDP SEO metadata. |
| 2026-05-20 | Keyed PSI retry after PageSpeed API enablement (`5fd9b8fd3426598cb970c669bef9ed1b497e37b6`; includes #1790) | OgaBassey home | mobile | 92 | 100 | 100 | 100 | 3151 ms | 1201 ms | 79 ms | 0.001 | PSI now runs with the `.env.local` key. Home mobile regressed/noised above target again, but all non-performance categories are green and LCP discovery passes. The mobile hero AVIF request is preloaded/high priority, starts at 1207 ms, and finishes at 1423 ms. |
| 2026-05-20 | Keyed PSI retry after PageSpeed API enablement (`5fd9b8fd3426598cb970c669bef9ed1b497e37b6`; includes #1790) | OgaBassey home | desktop | 99 | 100 | 100 | 100 | 777 ms | 321 ms | 22 ms | 0.000 | PSI confirms desktop home remains healthy. |
| 2026-05-20 | Keyed PSI retry after PageSpeed API enablement (`5fd9b8fd3426598cb970c669bef9ed1b497e37b6`; includes #1790) | OgaBassey PDP | mobile | 87 | 100 | 100 | 100 | 3976 ms | 1201 ms | 36 ms | 0.000 | PSI restores PDP SEO to 100, so metadata is not the current blocker. The product image is still the LCP node, LCP discovery passes, and the high-priority preload starts at 924 ms and finishes at 967 ms shortly after the document finishes at 874 ms. The image transfer is not the bottleneck; the next diagnostic should focus on why the already-loaded product image does not paint until 3976 ms. The raw `label-content-name-mismatch` audit still flags the sticky Add to Cart button, but the accessibility category remains 100. |
| 2026-05-20 | Keyed PSI retry after PageSpeed API enablement (`5fd9b8fd3426598cb970c669bef9ed1b497e37b6`; includes #1790) | OgaBassey PDP | desktop | 79 | 100 | 100 | 100 | 909 ms | 321 ms | 425 ms | 0.045 | PSI confirms desktop PDP LCP/SEO/a11y/BP are green, but TBT is above the 200 ms guardrail. The longest task is Google Publisher Tags (`pubads_impl.js`, 200 ms), followed by app chunks at 129 ms and 115 ms. Keep this as a separate desktop ad/GPT TBT follow-up. |

## 2026-05-19 PDP mobile follow-up evidence

Source captures:

- PSI JSON output saved locally under `/tmp/ogabassey-psi-2026-05-19T21-20-11-030Z/`.
- Read-only Vercel production inspection showed the active production alias on a deployment newer than PR #1763 and containing `fa2e087a0951f4cfd7f7c32a582b938cab14947c`.
- Curl against `https://ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090` still returned an old edge-cached HTML object (`x-vercel-cache: HIT`, age about 19k seconds), so DOM ordering from curl alone is not reliable until the cache refreshes.
- A Playwright resource-timing check on the live PDP showed the product image preload request starting immediately after the streamed HTML response completed: navigation `responseEnd` about 2052 ms, product image preload `startTime` about 2054 ms.

Decision:

- Do not continue with the broad PDP bundle-trim plan as the next slice. Latest mobile PDP TBT is 65 ms and Lighthouse's duplicated-JS/cache/render-blocking insights are clean.
- The next narrow intervention should move product-image resource discovery earlier in the server render. Keep the native link fallback from PR #1763, but add an imperative React DOM `preload()` call as soon as the PDP product image is known so React can emit the responsive image hint before the rest of the streamed page finishes.

## 2026-05-20 post-#1790 web-quality audit evidence

Source captures:

- PR #1790 merged as `5ac0f34a44b05df7b6e970b0a382a1f39cfe46c1` and Vercel listed a production deployment for it. The live production alias measured during this audit was newer (`5fd9b8fd3426598cb970c669bef9ed1b497e37b6`) and therefore includes #1790 plus later `main` changes.
- PSI API attempt with the configured key failed for all four home/PDP mobile/desktop requests: `Requests to this API pagespeedonline method google.chrome.pagespeedonline.v5.PagespeedonlinePagespeedapi.RunPagespeed are blocked.` Saved at `/tmp/ogabassey-psi-2026-05-20T21-19-59-218Z/summary.json`.
- A keyed retry after confirming the key loads from `.env.local` failed the same way for all four requests, with Google returning `API_KEY_SERVICE_BLOCKED` for the PageSpeed `RunPagespeed` method. Saved at `/tmp/ogabassey-psi-retry-2026-05-20T21-49-36-540Z/summary.json`.
- PSI retry without the key also failed for all four requests due daily shared quota: `Quota exceeded for quota metric 'Queries'`. Saved at `/tmp/ogabassey-psi-public-2026-05-20T21-20-29-062Z/summary.json`.
- After the PageSpeed API was enabled for the key's project, the keyed PSI retry succeeded for all four requests. Saved at `/tmp/ogabassey-psi-enabled-2026-05-20T21-55-22-473Z/summary.json`.
- Local Lighthouse 13.3.0 fallback evidence is saved at `/tmp/ogabassey-lighthouse-2026-05-20T21-27-29Z/summary.json`.
- Chrome/CDP browser timing evidence is saved at `/tmp/ogabassey-browser-audit-2026-05-20T21-25-39-758Z/summary.json`.
- Live HTML confirms the PDP product image responsive preload payload is present, including the #1790 React DOM `:HL[...]` hint and the native `<link rel="preload" as="image" ... imageSrcSet ... imageSizes ...>` fallback.

Decision:

- Stop duplicate product-image preload work for now. #1790 improved PDP product-image discovery, PSI LCP discovery passes, and the high-priority image transfer completes early relative to the 3976 ms mobile PDP LCP.
- Do not make PDP metadata/head SEO the next slice. Keyed PSI returns SEO 100 for PDP mobile and desktop; the local Lighthouse SEO 92 result is not reproduced by PSI.
- The next PDP slice should diagnose element-render/shell timing for the primary product image: the PSI mobile PDP image request starts at 924 ms and finishes at 967 ms, but LCP still lands at 3976 ms. Fix the sticky Add to Cart accessible-name mismatch in the same narrow pass if the touched component is adjacent.
- Treat desktop GPT/DoubleClick cost as a separate follow-up. It affects PSI desktop PDP TBT through a 200 ms `pubads_impl.js` long task and app chunk long tasks; it is not the mobile PDP LCP blocker.
