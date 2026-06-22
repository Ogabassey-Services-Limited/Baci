import {
  getDebugBearCategoryScore,
  getDebugBearMetric,
} from './debugbear-quick-test-utils.mjs';

const PSI_CATEGORIES = Object.freeze([
  'performance',
  'accessibility',
  'best-practices',
  'seo',
]);

function score(category) {
  return typeof category?.score === 'number'
    ? Math.round(category.score <= 1 ? category.score * 100 : category.score)
    : null;
}

function auditMetric(audits, id) {
  const value = audits?.[id]?.numericValue;
  return typeof value === 'number' ? value : null;
}

function normalizeFieldId(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    if (url.pathname !== '/') {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    return url.toString();
  } catch {
    return `${value ?? ''}`;
  }
}

function normalizeFieldPercentile(metricName, percentile) {
  if (typeof percentile !== 'number') return null;
  if (metricName === 'CUMULATIVE_LAYOUT_SHIFT_SCORE') {
    return percentile / 100;
  }
  return percentile;
}

export function getFieldMetric(payload, requestedUrl, metricName) {
  const candidates = [
    payload?.loadingExperience,
    payload?.originLoadingExperience,
  ];
  const requested = normalizeFieldId(requestedUrl);

  for (const candidate of candidates) {
    const metric = candidate?.metrics?.[metricName];
    if (!metric) continue;

    return {
      category: metric.category,
      p75: normalizeFieldPercentile(metricName, metric.percentile),
      scope: normalizeFieldId(candidate.id) === requested ? 'url' : 'origin',
    };
  }

  return null;
}

export function buildPsiUrl({ apiKey, strategy, url }) {
  const endpoint = new URL(
    'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
  );
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('strategy', strategy);
  for (const category of PSI_CATEGORIES) {
    endpoint.searchParams.append('category', category);
  }
  if (apiKey) endpoint.searchParams.set('key', apiKey);
  return endpoint;
}

export function summarizePsiResult({ label, payload, requestedUrl, strategy }) {
  const lighthouse = payload?.lighthouseResult ?? {};
  const audits = lighthouse.audits ?? {};
  const categories = lighthouse.categories ?? {};

  return {
    a11y: score(categories.accessibility),
    bp: score(categories['best-practices']),
    cls: auditMetric(audits, 'cumulative-layout-shift'),
    fieldCls: getFieldMetric(
      payload,
      requestedUrl,
      'CUMULATIVE_LAYOUT_SHIFT_SCORE'
    ),
    fieldFcp: getFieldMetric(
      payload,
      requestedUrl,
      'FIRST_CONTENTFUL_PAINT_MS'
    ),
    fieldInp: getFieldMetric(
      payload,
      requestedUrl,
      'INTERACTION_TO_NEXT_PAINT'
    ),
    fieldLcp: getFieldMetric(
      payload,
      requestedUrl,
      'LARGEST_CONTENTFUL_PAINT_MS'
    ),
    fieldTtfb: getFieldMetric(
      payload,
      requestedUrl,
      'EXPERIMENTAL_TIME_TO_FIRST_BYTE'
    ),
    fcpMs: auditMetric(audits, 'first-contentful-paint'),
    finalUrl: lighthouse.finalUrl ?? payload?.id ?? requestedUrl,
    label,
    lcpMs: auditMetric(audits, 'largest-contentful-paint'),
    performance: score(categories.performance),
    seo: score(categories.seo),
    source: 'psi',
    speedIndexMs: auditMetric(audits, 'speed-index'),
    strategy,
    tbtMs: auditMetric(audits, 'total-blocking-time'),
    url: requestedUrl,
  };
}

export function isDebugBearComplete(body) {
  const status = `${body?.status ?? body?.state ?? ''}`.toLowerCase();
  return (
    body?.hasFinished === true ||
    status === 'complete' ||
    status === 'completed' ||
    Boolean(body?.lighthouseResult) ||
    Boolean(body?.metrics?.['performance.largestContentfulPaint'])
  );
}

export function summarizeDebugBearResult({
  body,
  label,
  projectId,
  quickTestId,
  url,
}) {
  return {
    a11y: getDebugBearCategoryScore(body, ['accessibility']),
    bp: getDebugBearCategoryScore(body, [
      'best-practices',
      'bestPractices',
      'bestPractices.score',
      'best-practices.score',
    ]),
    cls: getDebugBearMetric(body, [
      'performance.cumulativeLayoutShift',
      'cumulativeLayoutShift',
      'cls',
      'cumulative-layout-shift',
    ]),
    consoleErrors: getDebugBearMetric(body, [
      'console.totalErrors',
      'console.errorCount',
      'consoleErrors',
    ]),
    fcpMs: getDebugBearMetric(body, [
      'performance.firstContentfulPaint',
      'firstContentfulPaint',
      'fcp',
      'first-contentful-paint',
    ]),
    label,
    lcpMs: getDebugBearMetric(body, [
      'performance.largestContentfulPaint',
      'largestContentfulPaint',
      'lcp',
      'largest-contentful-paint',
    ]),
    pageWeightKb: toKilobytes(
      getDebugBearMetric(body, [
        'pageWeight.total',
        'totalByteWeight',
        'pageWeight',
      ])
    ),
    performance: getDebugBearCategoryScore(body, ['performance']),
    projectId,
    quickTestId,
    resultUrl:
      body?.resultUrl ??
      body?.url ??
      (projectId && quickTestId
        ? `https://www.debugbear.com/project/${projectId}/quickTest/${quickTestId}/overview`
        : null),
    seo: getDebugBearCategoryScore(body, ['seo']),
    source: 'debugbear',
    speedIndexMs: getDebugBearMetric(body, [
      'performance.speedIndex',
      'speedIndex',
      'speed-index',
    ]),
    tbtMs: getDebugBearMetric(body, [
      'performance.totalBlockingTime',
      'totalBlockingTime',
      'tbt',
      'total-blocking-time',
    ]),
    url,
  };
}

function toKilobytes(bytes) {
  if (typeof bytes !== 'number') return null;
  return Math.round((bytes / 1024) * 10) / 10;
}

export function formatMetricMs(value) {
  return typeof value === 'number' ? Math.round(value) : null;
}
