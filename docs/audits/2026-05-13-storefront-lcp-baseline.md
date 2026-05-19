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
| 2026-05-19 | PR #1763 deployed (`fa2e087a0951f4cfd7f7c32a582b938cab14947c`), rechecked with `web-quality-skills` guidance | OgaBassey home | mobile | 95 | 100 | 100 | 100 | 2851 ms | 1201 ms | 29 ms | 0.001 | Still above the 2500 ms target, but much closer. LCP discovery passes; PSI reports a 415 ms resource-load delay and no render-blocking insight. |
| 2026-05-19 | PR #1763 deployed (`fa2e087a0951f4cfd7f7c32a582b938cab14947c`), rechecked with `web-quality-skills` guidance | OgaBassey home | desktop | 98 | 100 | 100 | 100 | 861 ms | 321 ms | 19 ms | 0.000 | Desktop remains good. |
| 2026-05-19 | PR #1763 deployed (`fa2e087a0951f4cfd7f7c32a582b938cab14947c`), rechecked with `web-quality-skills` guidance | OgaBassey PDP | mobile | 83 | 100 | 100 | 100 | 3976 ms | 1201 ms | 65 ms | 0.000 | Remaining primary blocker. LCP element is now the primary product image. LCP discovery passes, TBT is low, and unused JS is only about 21 KiB, but the LCP breakdown still shows about 2606 ms resource-load delay. |
| 2026-05-19 | PR #1763 deployed (`fa2e087a0951f4cfd7f7c32a582b938cab14947c`), rechecked with `web-quality-skills` guidance | OgaBassey PDP | desktop | 95 | 100 | 100 | 100 | 901 ms | 321 ms | 123 ms | 0.045 | Desktop PDP remains good. Google/DoubleClick ads account for most third-party main-thread time, but desktop TBT is still under the 300 ms budget. |

## 2026-05-19 PDP mobile follow-up evidence

Source captures:

- PSI JSON output saved locally under `/tmp/ogabassey-psi-2026-05-19T21-20-11-030Z/`.
- Read-only Vercel production inspection showed the active production alias on a deployment newer than PR #1763 and containing `fa2e087a0951f4cfd7f7c32a582b938cab14947c`.
- Curl against `https://ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090` still returned an old edge-cached HTML object (`x-vercel-cache: HIT`, age about 19k seconds), so DOM ordering from curl alone is not reliable until the cache refreshes.
- A Playwright resource-timing check on the live PDP showed the product image preload request starting immediately after the streamed HTML response completed: navigation `responseEnd` about 2052 ms, product image preload `startTime` about 2054 ms.

Decision:

- Do not continue with the broad PDP bundle-trim plan as the next slice. Latest mobile PDP TBT is 65 ms and Lighthouse's duplicated-JS/cache/render-blocking insights are clean.
- The next narrow intervention should move product-image resource discovery earlier in the server render. Keep the native link fallback from PR #1763, but add an imperative React DOM `preload()` call as soon as the PDP product image is known so React can emit the responsive image hint before the rest of the streamed page finishes.
| 2026-05-17 | PR #1727 deployed (`5c577817f887597e91dddbb3b7dd530fa01536cd`) | OgaBassey home | mobile | 90-97 | 100 | 2551-3376 ms | 1201 ms | 33-59 ms | 0.001 | #1727 removed the invalid hand-built `next.config.ts` Link preload that pointed at a 404. Live HTML now has zero references to the bad `b344efbb` URL, and the remaining static-imported mobile/desktop hero AVIF preloads return `200 image/avif` with immutable caching. PSI LCP discovery passes, so the remaining home gap is render/resource delay around the Suspense fallback hero, not a missing hero image request. |
| 2026-05-17 | PR #1728 deployed (`cefa5f8461287a67f6ccdff7989b044288e33a92`) | OgaBassey home | mobile | 90 | 100 | 3376 ms | 1201 ms | 67 ms | 0.001 | #1728 made the mobile hero decode synchronously. Live HTML shows `decoding="sync"` on the streamed real hero image and PSI identifies that real `iPhone 17 Pro Max` image as LCP. LCP discovery still passes, but the mobile AVIF request starts at about 1555 ms, immediately after the document stream finishes; the next fix removes the mobile preload's viewport `media` condition so the tiny 2 KB mobile AVIF can be acted on in the earliest preload phase. |
| 2026-05-17 | PR #1729 deployed (`46331be1bc6b002e92789c8281f7abffee812b33`) | OgaBassey home | mobile | 96 | 100 | 2251 ms | 1201 ms | 37 ms | 0.001 | #1729 removed the mobile hero preload's viewport `media` condition while keeping the desktop preload scoped. Three consecutive PSI mobile runs were stable at LCP 2251 ms, so the home route now meets the 2500 ms target. |
| 2026-05-17 | PR #1729 deployed (`46331be1bc6b002e92789c8281f7abffee812b33`) | OgaBassey PDP | mobile | 91 | 100 | 3226 ms | 1201 ms | 116 ms | 0.072 | Canonical PDP URL: `https://ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090`. The LCP image is the primary product image, discovered early through the existing preload and fetched at high priority, but it still renders with `decoding="async"`. Next slice: make only that primary PDP LCP image decode synchronously, then re-measure before larger bundle work. |
| 2026-05-17 | PR #1733 deployed (`ff53ed37a27f4360b26a0e9cc68412bcf2da41d3`) | OgaBassey PDP | mobile | 86 | 100 | 4051 ms | 1201 ms | 100-250 ms | 0.000 | Live HTML confirmed the primary product image renders with `decoding="sync"`, `loading="eager"`, and `fetchPriority="high"`, but PSI worsened/noised instead of improving. Detailed PSI showed about 120 KiB unused JS, 38 KiB unused CSS, 1.9 s main-thread work, and 934 ms script evaluation. The next measured bottleneck is PDP client bundle/main-thread work, not image discovery. |
| 2026-05-17 | PR #1733 deployed (`ff53ed37a27f4360b26a0e9cc68412bcf2da41d3`) | OgaBassey PDP | desktop | 82 | 100 | 1691 ms | 321 ms | 271 ms | 0.045 | Desktop LCP remains under target, but TBT is close to the 300 ms guardrail. Keep subsequent PDP bundle trims narrow and verify desktop TBT does not regress. |
| 2026-05-19 | PR #1756 deployed in latest `main` (`e5d2e8a7cc9c6aa3cf12e687cead96d899e67dfd`) | OgaBassey home | mobile | 95-97 | 100 | 2401-2851 ms | 1201 ms | 69-79 ms | 0.001 | Home remains near the threshold: one confirmation run passed at 2401 ms and the immediately prior run measured 2851 ms. SEO, CLS, and TBT stayed healthy. Keep home in the regression set but continue prioritizing PDP. |
| 2026-05-19 | PR #1756 deployed in latest `main` (`e5d2e8a7cc9c6aa3cf12e687cead96d899e67dfd`) | OgaBassey PDP | mobile | 81-85 | 100 | 3976-4051 ms | 1201 ms | 148-216 ms | 0.000-0.072 | #1756 reduced mobile PDP unused JS to about 21-23 KiB and unused CSS to 0, but LCP stayed poor. The new dominant subpart is product-image resource load delay (~1256-1489 ms) plus element render delay (~542-784 ms). Live HTML showed the product image hint emitted as a late RSC `:HL[...]` record around byte 15 KB, after body/scripts, not as an early native `<link>`. |
| 2026-05-19 | PR #1756 deployed in latest `main` (`e5d2e8a7cc9c6aa3cf12e687cead96d899e67dfd`) | OgaBassey PDP | desktop | 91 | 100 | 916 ms | 343 ms | 197 ms | 0.000 | Desktop PDP remains healthy after #1756. The follow-up should not regress desktop TBT, which is now just under the 200 ms target. |
