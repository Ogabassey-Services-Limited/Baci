import {
  AUDIT_THRESHOLDS,
  CATEGORY_THRESHOLDS,
  DEFAULT_PAGE_SPEED_ROUTES,
  EMPTY_PAGE_SPEED_SCORES,
  EMPTY_PAGE_SPEED_VITALS,
  PAGE_SPEED_TIMEOUT_MS,
} from './run-pagespeed.config';
import type {
  PageSpeedApiResponse,
  PageSpeedAuditResult,
  PageSpeedFailure,
  PageSpeedStrategy,
  PageSpeedTarget,
} from './run-pagespeed.types';
import { seoShared } from './shared';

function buildPageSpeedTargets({
  baseUrl,
  extraUrls,
}: {
  baseUrl: string;
  extraUrls: string[];
}): PageSpeedTarget[] {
  const normalizedBaseUrl = seoShared.normalizeOrigin(baseUrl);
  const defaults = DEFAULT_PAGE_SPEED_ROUTES.map((route) => ({
    label: route.label,
    url: seoShared.resolveUrl(normalizedBaseUrl, route.path),
  }));
  const extras = extraUrls.map((url, index) => ({
    label: `extra-${index + 1}`,
    url: parseHttpUrl(url),
  }));
  return dedupeTargets([...defaults, ...extras]);
}

function parseStrategies(value?: string): PageSpeedStrategy[] {
  const entries =
    value
      ?.split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean) ?? [];
  if (entries.length === 0) {
    return ['mobile'];
  }
  const invalidEntries = [...new Set(entries)].filter(
    (entry) => entry !== 'mobile' && entry !== 'desktop'
  );
  if (invalidEntries.length > 0) {
    throw new Error(
      `Invalid PageSpeed strategies: ${invalidEntries.join(', ')}. Allowed values: mobile, desktop`
    );
  }
  return [...new Set(entries as PageSpeedStrategy[])];
}

function buildPsiUrl({
  apiKey,
  strategy,
  targetUrl,
}: {
  apiKey?: string;
  strategy: PageSpeedStrategy;
  targetUrl: string;
}): string {
  const url = new URL(
    'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
  );
  url.searchParams.set('url', targetUrl);
  url.searchParams.set('strategy', strategy);
  for (const category of [
    'performance',
    'accessibility',
    'best-practices',
    'seo',
  ]) {
    url.searchParams.append('category', category);
  }
  if (apiKey) {
    url.searchParams.set('key', apiKey);
  }
  return url.toString();
}

function evaluatePageSpeedResult(
  payload: PageSpeedApiResponse
): Omit<PageSpeedAuditResult, 'label' | 'strategy' | 'url'> {
  const tbt = getAuditMetric(payload, 'total-blocking-time');
  const fieldInp = getFieldMetric(payload, 'INTERACTION_TO_NEXT_PAINT');
  const labInp = getAuditMetric(payload, 'interaction-to-next-paint');
  const scores = {
    performance: getCategoryScore(payload, 'performance'),
    accessibility: getCategoryScore(payload, 'accessibility'),
    seo: getCategoryScore(payload, 'seo'),
    'best-practices': getCategoryScore(payload, 'best-practices'),
  };
  const vitals = {
    lcp: getAuditMetric(payload, 'largest-contentful-paint'),
    cls: getAuditMetric(payload, 'cumulative-layout-shift'),
    tbt,
    inp: fieldInp ?? labInp,
  };
  const failures: PageSpeedFailure[] = [];
  for (const metric of [
    'performance',
    'accessibility',
    'seo',
    'best-practices',
  ] as const) {
    const actual = scores[metric];
    const threshold = CATEGORY_THRESHOLDS[metric];
    if (actual === null || actual < threshold) {
      failures.push({ metric, actual, threshold });
    }
  }
  for (const metric of ['lcp', 'cls', 'tbt'] as const) {
    const actual = vitals[metric];
    const threshold = AUDIT_THRESHOLDS[metric];
    if (actual === null || actual > threshold) {
      failures.push({ metric, actual, threshold });
    }
  }
  if (vitals.inp === null || vitals.inp > AUDIT_THRESHOLDS.inp) {
    failures.push({
      metric: 'inp',
      actual: vitals.inp,
      threshold: AUDIT_THRESHOLDS.inp,
    });
  }

  return {
    passed: failures.length === 0,
    failures,
    scores,
    vitals,
  };
}

async function runPageSpeedAudit({
  apiKey,
  baseUrl,
  extraUrls,
  fetchImpl = fetch,
  strategies,
}: {
  apiKey?: string;
  baseUrl: string;
  extraUrls: string[];
  fetchImpl?: typeof fetch;
  strategies: PageSpeedStrategy[];
}): Promise<PageSpeedAuditResult[]> {
  const targets = buildPageSpeedTargets({ baseUrl, extraUrls });
  const results: PageSpeedAuditResult[] = [];

  for (const target of targets) {
    for (const strategy of strategies) {
      try {
        const payload = await fetchPageSpeedPayload(fetchImpl, {
          apiKey,
          strategy,
          targetUrl: target.url,
        });
        results.push({
          label: target.label,
          strategy,
          url: target.url,
          ...evaluatePageSpeedResult(payload),
        });
      } catch (error) {
        results.push({
          failures: [
            {
              metric: 'request',
              actual: null,
              message: error instanceof Error ? error.message : String(error),
              threshold: 0,
            },
          ],
          label: target.label,
          passed: false,
          scores: EMPTY_PAGE_SPEED_SCORES,
          strategy,
          url: target.url,
          vitals: EMPTY_PAGE_SPEED_VITALS,
        });
      }
    }
  }
  return results;
}

function getCategoryScore(
  payload: PageSpeedApiResponse,
  key: keyof typeof CATEGORY_THRESHOLDS
): number | null {
  const score = payload.lighthouseResult?.categories?.[key]?.score;
  return typeof score === 'number' ? score : null;
}

function getAuditMetric(
  payload: PageSpeedApiResponse,
  key: string
): number | null {
  const numericValue = payload.lighthouseResult?.audits?.[key]?.numericValue;
  return typeof numericValue === 'number' ? numericValue : null;
}

function getFieldMetric(
  payload: PageSpeedApiResponse,
  key: string
): number | null {
  const metric =
    payload.loadingExperience?.metrics?.[key]?.percentile ??
    payload.originLoadingExperience?.metrics?.[key]?.percentile;
  return typeof metric === 'number' ? metric : null;
}

function dedupeTargets(targets: PageSpeedTarget[]): PageSpeedTarget[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    if (seen.has(target.url)) {
      return false;
    }
    seen.add(target.url);
    return true;
  });
}

function buildPageSpeedSummary(results: PageSpeedAuditResult[]): string {
  const lines = ['## PageSpeed Insights'];
  for (const result of results) {
    lines.push(
      `- ${result.label} (${result.strategy}): ${result.passed ? 'PASS' : 'FAIL'}`
    );
    if (!result.passed) {
      for (const failure of result.failures) {
        lines.push(
          failure.message
            ? `  - ${failure.metric}: ${failure.message}`
            : `  - ${failure.metric}: ${
                failure.actual === null ? 'missing' : String(failure.actual)
              } (threshold ${failure.threshold})`
        );
      }
    }
  }
  return `${lines.join('\n')}\n`;
}

function parseHttpUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`unsupported protocol ${parsed.protocol}`);
    }
    return parsed.toString();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid PageSpeed target URL "${value}": ${reason}`);
  }
}

async function fetchPageSpeedPayload(
  fetchImpl: typeof fetch,
  options: Parameters<typeof buildPsiUrl>[0]
): Promise<PageSpeedApiResponse> {
  const controller = new AbortController();
  const timeoutMs = resolveTimeoutMs();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(buildPsiUrl(options), {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `PageSpeed Insights request failed for ${options.targetUrl} (${options.strategy}) with status ${response.status}`
      );
    }
    return (await response.json()) as PageSpeedApiResponse;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        `PageSpeed Insights request timed out for ${options.targetUrl} (${options.strategy}) after ${timeoutMs}ms`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function resolveTimeoutMs(): number {
  const rawValue = process.env.PAGE_SPEED_TIMEOUT_MS;
  if (!rawValue) return PAGE_SPEED_TIMEOUT_MS;
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid PAGE_SPEED_TIMEOUT_MS value "${rawValue}". Expected a positive integer in milliseconds.`
    );
  }
  return parsed;
}

export const pageSpeedTools = {
  buildPageSpeedSummary,
  buildPageSpeedTargets,
  buildPsiUrl,
  evaluatePageSpeedResult,
  parseStrategies,
  runPageSpeedAudit,
} as const;
