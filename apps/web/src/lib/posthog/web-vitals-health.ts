import {
  getPostHogProjectId,
  getPostHogServerApiKey,
  getPostHogUiHost,
  type PostHogEnv,
} from '@/lib/posthog/config';
import {
  type PostHogWebVitalsQueryResponse,
  postHogWebVitalsQueryResponseSchema,
} from '@/schemas/web-vitals-health';

// Coverage floor: at least half of eligible (non-blog) pageviews should carry a
// web-vitals report. Field data measured ~1.7% before the queue-and-flush fix.
const MIN_CAPTURE_RATIO = 0.5;
// Inversion signature: TTFB and FCP fire earliest, so pre-fix they were the
// rarest. Post-fix every eligible pageview should emit each metric roughly once,
// so TTFB/FCP dropping below 40% of the LCP count flags a regression.
const INVERSION_METRIC_FLOOR = 0.4;

// Aggregate columns in SELECT order — HogQL returns rows as positional arrays.
const COLUMN_INDEX = {
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
const BLOG_FIRST_SEGMENT_PATTERN = '^/blog(/|$)';
const BLOG_TENANT_SEGMENT_PATTERN = '^/[^/]+/blog(/|$)';
const RESERVED_FIRST_SEGMENT_PATTERN =
  '^/(_next|admin|api|auth|builder|checkout|dashboard|feeds|login|logout|track)(/|$)';

// HogQL boolean matching a `$pageview` whose pathname is NOT a public blog
// surface, i.e. a pageview that is eligible to report web vitals.
const NON_BLOG_PAGEVIEW_PREDICATE = `event = '$pageview'
    AND NOT (
      match(lower(coalesce(properties.$pathname, '')), '${BLOG_FIRST_SEGMENT_PATTERN}')
      OR (
        match(lower(coalesce(properties.$pathname, '')), '${BLOG_TENANT_SEGMENT_PATTERN}')
        AND NOT match(lower(coalesce(properties.$pathname, '')), '${RESERVED_FIRST_SEGMENT_PATTERN}')
      )
    )`;

const WEB_VITALS_HEALTH_QUERY = `
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
    countIf(event = 'web_vitals' AND properties.metric = 'LCP'),
    countIf(event = 'web_vitals' AND properties.metric = 'FCP'),
    countIf(event = 'web_vitals' AND properties.metric = 'TTFB'),
    countIf(event = 'web_vitals' AND properties.metric = 'CLS'),
    countIf(event = 'web_vitals' AND properties.metric = 'INP')
  ) AS vitals_pageviews,
  countIf(${NON_BLOG_PAGEVIEW_PREDICATE}) AS non_blog_pageviews
FROM events
WHERE timestamp >= now() - INTERVAL 24 HOUR
  AND event IN ('web_vitals', '$pageview')
`.trim();

export interface WebVitalsHealthCounts {
  webVitalsTotal: number;
  lcp: number;
  fcp: number;
  ttfb: number;
  cls: number;
  inp: number;
  vitalsPageviews: number;
  nonBlogPageviews: number;
}

export type WebVitalsHealthStatus = 'ok' | 'degraded' | 'skipped' | 'error';

export interface WebVitalsHealthResult {
  status: WebVitalsHealthStatus;
  reason?: string;
  captureRatio: number | null;
  counts?: WebVitalsHealthCounts;
  warnings: string[];
}

type HogqlCell = number | string | null;

function toFiniteNumber(cell: HogqlCell | undefined): number {
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    return cell;
  }

  if (typeof cell === 'string') {
    const parsed = Number(cell);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function extractCounts(row: HogqlCell[]): WebVitalsHealthCounts {
  return {
    webVitalsTotal: toFiniteNumber(row[COLUMN_INDEX.webVitalsTotal]),
    lcp: toFiniteNumber(row[COLUMN_INDEX.lcp]),
    fcp: toFiniteNumber(row[COLUMN_INDEX.fcp]),
    ttfb: toFiniteNumber(row[COLUMN_INDEX.ttfb]),
    cls: toFiniteNumber(row[COLUMN_INDEX.cls]),
    inp: toFiniteNumber(row[COLUMN_INDEX.inp]),
    vitalsPageviews: toFiniteNumber(row[COLUMN_INDEX.vitalsPageviews]),
    nonBlogPageviews: toFiniteNumber(row[COLUMN_INDEX.nonBlogPageviews]),
  };
}

function collectWarnings(
  counts: WebVitalsHealthCounts,
  captureRatio: number | null
): string[] {
  const warnings: string[] = [];

  if (captureRatio !== null && captureRatio < MIN_CAPTURE_RATIO) {
    warnings.push('low_capture_ratio');
  }

  if (counts.lcp > 0) {
    const floor = counts.lcp * INVERSION_METRIC_FLOOR;
    if (counts.ttfb < floor) {
      warnings.push('ttfb_inversion');
    }
    if (counts.fcp < floor) {
      warnings.push('fcp_inversion');
    }
  }

  return warnings;
}

function evaluateResponse(
  response: PostHogWebVitalsQueryResponse
): WebVitalsHealthResult {
  const row = response.results[0];

  if (!row) {
    return {
      status: 'error',
      reason: 'posthog_empty_results',
      captureRatio: null,
      warnings: [],
    };
  }

  const counts = extractCounts(row);
  const captureRatio =
    counts.nonBlogPageviews > 0
      ? counts.vitalsPageviews / counts.nonBlogPageviews
      : null;
  const warnings = collectWarnings(counts, captureRatio);

  return {
    status: warnings.length > 0 ? 'degraded' : 'ok',
    captureRatio,
    counts,
    warnings,
  };
}

/**
 * Queries PostHog for the last 24h of web-vitals capture health and evaluates
 * the capture ratio + per-metric inversion signature. Fail-open by design: any
 * PostHog-side problem (missing config, non-2xx, malformed body, network error)
 * resolves to a `skipped`/`error` result rather than throwing, so the cron can
 * always return 200.
 */
export async function runWebVitalsHealthCheck(
  env: PostHogEnv = process.env
): Promise<WebVitalsHealthResult> {
  const apiKey = getPostHogServerApiKey(env);
  const projectId = getPostHogProjectId(env);

  if (!apiKey || !projectId) {
    return {
      status: 'skipped',
      reason: 'posthog_not_configured',
      captureRatio: null,
      warnings: [],
    };
  }

  const endpoint = `${getPostHogUiHost(env)}/api/projects/${projectId}/query/`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: { kind: 'HogQLQuery', query: WEB_VITALS_HEALTH_QUERY },
      }),
      cache: 'no-store',
    });
  } catch {
    return {
      status: 'error',
      reason: 'posthog_request_failed',
      captureRatio: null,
      warnings: [],
    };
  }

  if (!response.ok) {
    return {
      status: 'error',
      reason: `posthog_http_${response.status}`,
      captureRatio: null,
      warnings: [],
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      status: 'error',
      reason: 'posthog_response_unparsable',
      captureRatio: null,
      warnings: [],
    };
  }

  const parsed = postHogWebVitalsQueryResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: 'error',
      reason: 'posthog_response_invalid',
      captureRatio: null,
      warnings: [],
    };
  }

  return evaluateResponse(parsed.data);
}

export {
  BLOG_FIRST_SEGMENT_PATTERN,
  BLOG_TENANT_SEGMENT_PATTERN,
  INVERSION_METRIC_FLOOR,
  MIN_CAPTURE_RATIO,
  RESERVED_FIRST_SEGMENT_PATTERN,
  WEB_VITALS_HEALTH_QUERY,
};
