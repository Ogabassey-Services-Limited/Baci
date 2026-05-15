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

| Date | Change | Page | Strategy | Perf | SEO | LCP | FCP | TBT | CLS | Notes |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 2026-05-15 | PR #1671 deployed (`9882bb8451a168425bb5ef7001e511602c076d32`) | OgaBassey home | mobile | 87 | 100 | 3376 ms | 1201 ms | 76 ms | 0.001 | LCP request is discoverable/eager/high priority, but appears via RSC `:HL` stream data rather than a native initial-head link; resource load delay remains about 2080 ms. |
| 2026-05-15 | PR #1671 deployed (`9882bb8451a168425bb5ef7001e511602c076d32`) | OgaBassey home | desktop | 99 | 100 | 761 ms | 281 ms | 6 ms | 0.000 | Desktop home is healthy. |
| 2026-05-15 | PR #1671 deployed (`9882bb8451a168425bb5ef7001e511602c076d32`) | OgaBassey PDP | mobile | 84 | 100 | 3226 ms | 1201 ms | 358 ms | 0.072 | Improved from the prior 4824 ms plan baseline, but still over target; remaining bottleneck is main-thread JS work, not image discovery. |
| 2026-05-15 | PR #1671 deployed (`9882bb8451a168425bb5ef7001e511602c076d32`) | OgaBassey PDP | desktop | 68 | 100 | 1182 ms | 403 ms | 589 ms | 0.000 | LCP is now under target; TBT is noisy/high, partly from ad scripts and shared storefront JS. |
