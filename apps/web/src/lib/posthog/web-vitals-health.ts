import {
  getPostHogProjectId,
  getPostHogServerApiKey,
  getPostHogUiHost,
  type PostHogEnv,
} from '@/lib/posthog/config';
import {
  COLUMN_INDEX,
  WEB_VITALS_HEALTH_QUERY,
} from '@/lib/posthog/web-vitals-health-query';
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

export { INVERSION_METRIC_FLOOR, MIN_CAPTURE_RATIO };
