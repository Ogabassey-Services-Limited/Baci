// HogQL query + column layout for the web-vitals capture-health check.
// Split from web-vitals-health.ts to respect the 300-line file cap; the
// evaluation logic lives there and imports this query verbatim.

export const COLUMN_INDEX = {
  webVitalsTotal: 0,
  lcp: 1,
  fcp: 2,
  ttfb: 3,
  cls: 4,
  inp: 5,
  vitalsPageviews: 6,
  nonBlogPageviews: 7,
} as const;

// --- Blog-surface parity (MUST mirror `isPublicBlogPathname` in
// `@/lib/posthog/public-blog-path`) -----------------------------------------
// The client (`report-web-vital.ts` → `isPublicBlogPathname`) DROPS Core Web
// Vitals on public blog/SEO surfaces before they are ever buffered, so those
// pageviews never carry a report. The capture-ratio denominator must therefore
// exclude EXACTLY the surfaces the client suppresses — no more, no less. A blunt
// `$pathname LIKE '%/blog%'` over-excludes real pages (`/dashboard/blog-settings`,
// `/products/blogger-bag`), which shrinks the denominator and masks a genuinely
// low capture ratio.
//
// Mirrored client semantics (see public-blog-path.ts):
//   • first path segment === 'blog'              → `/blog`, `/blog/…`
//   • OR second segment === 'blog' AND the first  → `/<slug>/blog`, `/<slug>/blog/…`
//     segment is NOT a platform-reserved word
// Matching runs on a lower-cased pathname to mirror the client's per-segment
// `.toLowerCase()`. RESERVED_FIRST_SEGMENT_PATTERN MUST stay in sync with
// PLATFORM_RESERVED_FIRST_SEGMENTS in public-blog-path.ts.
//
// One deliberate divergence: the client also gates the tenant-prefixed
// `/<slug>/blog` shape on platform-path-mode hosts. HogQL aggregates across every
// host and cannot resolve the per-event host cheaply, so this predicate treats
// the tenant shape as blog on any host. The only affected input is a
// custom-domain `/<slug>/blog`, which effectively never occurs.
export const BLOG_FIRST_SEGMENT_PATTERN = '^/blog(/|$)';
export const BLOG_TENANT_SEGMENT_PATTERN = '^/[^/]+/blog(/|$)';
export const RESERVED_FIRST_SEGMENT_PATTERN =
  '^/(_next|admin|api|auth|builder|checkout|dashboard|feeds|login|logout|track)(/|$)';

// HogQL boolean matching a `$pageview` whose pathname is NOT a public blog
// surface, i.e. a pageview that is eligible to report web vitals.
//
// INITIAL-DOCUMENT-LOAD parity: Core Web Vitals fire once per HARD document load
// (the web-vitals library never re-emits on SPA route changes), but posthog-js
// captures a fresh `$pageview` on every client-side navigation too. Counting
// those SPA pageviews would inflate the denominator and understate the capture
// ratio (a false `low_capture_ratio`). posthog-js's PageViewManager keeps the
// previous pageview only IN MEMORY and stamps `$prev_pageview_pathname` on every
// pageview EXCEPT the first since the document loaded (verified in
// posthog-js@1.393.5 `src/page-view.ts`: `_previousPageViewProperties` returns no
// `$prev_pageview_*` while `_currentPageview` is unset, and that field is
// memory-only so it resets on each hard load; our manual
// `posthog.capture('$pageview')` in browser.ts still routes through `doPageView`
// via `calculateEventProperties(..., readOnly=false)`). Restricting to rows that
// LACK `$prev_pageview_pathname` therefore keeps exactly the initial document
// loads that could have carried a web-vitals report, matching the numerator.
// KNOWN ± (documented, accepted): a session that LANDS on a public blog page
// boots the full PostHog client only on its first non-blog navigation, so that
// first post-blog SPA pageview lacks $prev_pageview_pathname and counts here
// even though its document load (the blog page) could not emit vitals. This is
// a small, one-per-blog-landing-session over-count in the denominator of a
// THRESHOLDED health heuristic (floors at 50%) — acceptable; tightening it
// would need a sessions-table join for entry-page classification.
export const NON_BLOG_PAGEVIEW_PREDICATE = `event = '$pageview'
    AND properties.$prev_pageview_pathname IS NULL
    AND NOT (
      match(lower(coalesce(properties.$pathname, '')), '${BLOG_FIRST_SEGMENT_PATTERN}')
      OR (
        match(lower(coalesce(properties.$pathname, '')), '${BLOG_TENANT_SEGMENT_PATTERN}')
        AND NOT match(lower(coalesce(properties.$pathname, '')), '${RESERVED_FIRST_SEGMENT_PATTERN}')
      )
    )`;

export const WEB_VITALS_HEALTH_QUERY = `
SELECT
  countIf(event = 'web_vitals') AS web_vitals_total,
  countIf(event = 'web_vitals' AND properties.metric = 'LCP') AS lcp,
  countIf(event = 'web_vitals' AND properties.metric = 'FCP') AS fcp,
  countIf(event = 'web_vitals' AND properties.metric = 'TTFB') AS ttfb,
  countIf(event = 'web_vitals' AND properties.metric = 'CLS') AS cls,
  countIf(event = 'web_vitals' AND properties.metric = 'INP') AS inp,
  -- Pageviews that carried a web-vitals report. The recovered pre-boot metrics
  -- (TTFB/FCP, and LCP on fast/no-interaction pages) are captured BEFORE the
  -- first $pageview, so posthog-js stamps no $pageview_id on them. A
  -- count(DISTINCT properties.$pageview_id) would drop exactly the metrics this
  -- check exists to validate, systematically undercounting and firing false
  -- low_capture_ratio alarms. Each eligible pageview emits each metric at most
  -- once, so the largest per-metric count is a $pageview_id-independent lower
  -- bound on the number of pageviews that reported vitals.
  greatest(
    greatest(
      countIf(event = 'web_vitals' AND properties.metric = 'LCP'),
      countIf(event = 'web_vitals' AND properties.metric = 'FCP')
    ),
    greatest(
      countIf(event = 'web_vitals' AND properties.metric = 'TTFB'),
      greatest(
        countIf(event = 'web_vitals' AND properties.metric = 'CLS'),
        countIf(event = 'web_vitals' AND properties.metric = 'INP')
      )
    )
  ) AS vitals_pageviews,
  countIf(${NON_BLOG_PAGEVIEW_PREDICATE}) AS non_blog_pageviews
FROM events
WHERE timestamp >= now() - INTERVAL 24 HOUR
  AND event IN ('web_vitals', '$pageview')
`.trim();
