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

interface BuildPageSpeedTargetsOptions {
  baseUrl: string;
  extraUrls: string[];
}

interface BuildPsiUrlOptions {
  apiKey?: string;
  strategy: PageSpeedStrategy;
  targetUrl: string;
}

interface RunPageSpeedAuditOptions {
  apiKey?: string;
  baseUrl: string;
  extraUrls: string[];
  fetchImpl?: typeof fetch;
  strategies: PageSpeedStrategy[];
}

export function buildPageSpeedTargets({
  baseUrl,
  extraUrls,
}: BuildPageSpeedTargetsOptions): PageSpeedTarget[] {
  const normalizedBaseUrl = normalizeOrigin(baseUrl);

  const defaults = DEFAULT_PAGE_SPEED_ROUTES.map((route) => ({
    label: route.label,
    url: resolveUrl(normalizedBaseUrl, route.path),
  }));

  const extras = extraUrls.flatMap((url, index) => {
    const parsed = safelyParseAbsoluteUrl(url);

    if (!parsed) {
      return [];
    }

    return [
      {
        label: `extra-${index + 1}`,
        url: parsed,
      },
    ];
  });

  return dedupeTargets([...defaults, ...extras]);
}

export function parseStrategies(value?: string): PageSpeedStrategy[] {
  if (!value) {
    return ['mobile'];
  }

  const parsed = value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(
      (entry): entry is PageSpeedStrategy =>
        entry === 'mobile' || entry === 'desktop'
    );

  return parsed.length > 0 ? [...new Set(parsed)] : ['mobile'];
}

export function buildPsiUrl({
  apiKey,
  strategy,
  targetUrl,
}: BuildPsiUrlOptions): string {
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
}: RunPageSpeedAuditOptions): Promise<PageSpeedAuditResult[]> {
  const targets = buildPageSpeedTargets({ baseUrl, extraUrls });
  const results: PageSpeedAuditResult[] = [];

  for (const target of targets) {
    for (const strategy of strategies) {
      const response = await fetchImpl(
        buildPsiUrl({
          apiKey,
          strategy,
          targetUrl: target.url,
        })
      );

      if (!response.ok) {
        throw new Error(
          `PageSpeed Insights request failed for ${target.url} (${strategy}) with status ${response.status}`
        );
      }

      const payload = (await response.json()) as PageSpeedApiResponse;
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
  const value = payload.lighthouseResult?.audits?.[key]?.numericValue;
  return typeof value === 'number' ? value : null;
}

function dedupeTargets(targets: PageSpeedTarget[]): PageSpeedTarget[] {
  const seen = new Set<string>();
  const deduped: PageSpeedTarget[] = [];

  for (const target of targets) {
    if (seen.has(target.url)) {
      continue;
    }

    seen.add(target.url);
    deduped.push(target);
  }

  return deduped;
}

function formatMetricValue(value: number | null): string {
  return value === null ? 'missing' : String(value);
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
          `  - ${failure.metric}: ${formatMetricValue(
            failure.actual
          )} (threshold ${failure.threshold})`
        );
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

function safelyParseAbsoluteUrl(value: string): string | null {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}
