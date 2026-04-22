import { normalizeOrigin, resolveUrl } from './shared';

const DEFAULT_PAGE_SPEED_ROUTES = [
  { label: 'home', path: '/' },
  { label: 'pricing', path: '/pricing' },
  { label: 'features', path: '/features' },
  { label: 'blog', path: '/blog' },
  { label: 'contact', path: '/contact' },
] as const;

const CATEGORY_THRESHOLDS = {
  performance: 0.8,
  accessibility: 0.9,
  seo: 0.9,
  'best-practices': 0.85,
} as const;

const AUDIT_THRESHOLDS = {
  lcp: 2500,
  cls: 0.1,
  tbt: 200,
  inp: 300,
} as const;
const PAGE_SPEED_TIMEOUT_MS = 15_000;

type PageSpeedStrategy = 'mobile' | 'desktop';
export interface PageSpeedTarget {
  label: string;
  url: string;
}
export interface PageSpeedFailure {
  metric: string;
  actual: number | null;
  threshold: number;
}
export interface PageSpeedAuditResult {
  label: string;
  url: string;
  strategy: PageSpeedStrategy;
  passed: boolean;
  failures: PageSpeedFailure[];
  scores: Record<string, number | null>;
  vitals: Record<string, number | null>;
}

interface PageSpeedApiResponse {
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null } | undefined>;
    audits?: Record<string, { numericValue?: number | null } | undefined>;
  };
}

export function buildPageSpeedTargets({
  baseUrl,
  extraUrls,
}: {
  baseUrl: string;
  extraUrls: string[];
}): PageSpeedTarget[] {
  const normalizedBaseUrl = normalizeOrigin(baseUrl);
  const defaults = DEFAULT_PAGE_SPEED_ROUTES.map((route) => ({
    label: route.label,
    url: resolveUrl(normalizedBaseUrl, route.path),
  }));
  const extras = extraUrls.map((url, index) => ({
    label: `extra-${index + 1}`,
    url: parseHttpUrl(url),
  }));

  return dedupeTargets([...defaults, ...extras]);
}

export function parseStrategies(value?: string): PageSpeedStrategy[] {
  const parsed =
    value
      ?.split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(
        (entry): entry is PageSpeedStrategy =>
          entry === 'mobile' || entry === 'desktop'
      ) ?? [];
  return parsed.length > 0 ? [...new Set(parsed)] : ['mobile'];
}

export function buildPsiUrl({
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

export function evaluatePageSpeedResult(
  payload: PageSpeedApiResponse
): Omit<PageSpeedAuditResult, 'label' | 'strategy' | 'url'> {
  const scores = {
    performance: getCategoryScore(payload, 'performance'),
    accessibility: getCategoryScore(payload, 'accessibility'),
    seo: getCategoryScore(payload, 'seo'),
    'best-practices': getCategoryScore(payload, 'best-practices'),
  };

  const vitals = {
    lcp: getAuditMetric(payload, 'largest-contentful-paint'),
    cls: getAuditMetric(payload, 'cumulative-layout-shift'),
    tbt: getAuditMetric(payload, 'total-blocking-time'),
    inp: getAuditMetric(payload, 'interaction-to-next-paint'),
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

  for (const metric of ['lcp', 'cls', 'tbt', 'inp'] as const) {
    const actual = vitals[metric];
    const threshold = AUDIT_THRESHOLDS[metric];

    if (actual === null || actual > threshold) {
      failures.push({ metric, actual, threshold });
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    scores,
    vitals,
  };
}

export async function runPageSpeedAudit({
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

export function buildPageSpeedSummary(results: PageSpeedAuditResult[]): string {
  const lines = ['## PageSpeed Insights'];

  for (const result of results) {
    lines.push(
      `- ${result.label} (${result.strategy}): ${result.passed ? 'PASS' : 'FAIL'}`
    );

    if (!result.passed) {
      for (const failure of result.failures) {
        lines.push(
          `  - ${failure.metric}: ${
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
  const timeout = setTimeout(() => controller.abort(), PAGE_SPEED_TIMEOUT_MS);

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
        `PageSpeed Insights request timed out for ${options.targetUrl} (${options.strategy}) after ${PAGE_SPEED_TIMEOUT_MS}ms`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
