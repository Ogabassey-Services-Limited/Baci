import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));
const outputDir =
  process.env.OGABASSEY_AUDIT_OUTPUT_DIR || join(repoRoot, 'output/audits');
const auditId = new Date().toISOString().replace(/[:.]/g, '-');

const routes = [
  {
    label: 'home',
    url: process.env.OGABASSEY_HOME_URL || 'https://ogabassey.com/',
  },
  {
    label: 'pdp',
    url:
      process.env.OGABASSEY_PDP_URL ||
      'https://ogabassey.com/laptops/dell-alienware-m18-r3-rtx-5080',
  },
];

const psiKey = process.env.PAGESPEED_INSIGHTS_API_KEY;
const debugBearProjectId = process.env.DEBUGBEAR_PROJECT_ID;
const debugBearApiKey =
  process.env.DEBUGBEAR_API_KEY || process.env.DEBUGBEAR_ADMIN_API_KEY;
const debugBearDevice = process.env.DEBUGBEAR_DEVICE || 'Mobile';
const debugBearMaxPollAttempts =
  Number(process.env.DEBUGBEAR_MAX_POLL_ATTEMPTS) || 90;
const debugBearPollIntervalMs =
  Number(process.env.DEBUGBEAR_POLL_INTERVAL_MS) || 5000;
const debugBearRegion = process.env.DEBUGBEAR_REGION || 'us-east';

function metric(audits, id) {
  const value = audits?.[id]?.numericValue;
  return typeof value === 'number' ? value : null;
}

function score(category) {
  return typeof category?.score === 'number'
    ? Math.round(category.score * 100)
    : null;
}

function summarizePsi(label, payload) {
  const lighthouse = payload.lighthouseResult;
  const audits = lighthouse?.audits;
  const categories = lighthouse?.categories;

  return {
    a11y: score(categories?.accessibility),
    bp: score(categories?.['best-practices']),
    cls: metric(audits, 'cumulative-layout-shift'),
    fcpMs: metric(audits, 'first-contentful-paint'),
    label,
    lcpMs: metric(audits, 'largest-contentful-paint'),
    performance: score(categories?.performance),
    seo: score(categories?.seo),
    source: 'psi',
    tbtMs: metric(audits, 'total-blocking-time'),
    url: lighthouse?.finalUrl || payload.id || '',
  };
}

function firstQuickTest(body) {
  if (Array.isArray(body)) return body[0] || null;
  if (Array.isArray(body.quickTests)) return body.quickTests[0] || null;
  if (Array.isArray(body.tests)) return body.tests[0] || null;
  return body;
}

function quickTestId(body) {
  const quickTest = firstQuickTest(body);
  return (
    quickTest?.id ||
    quickTest?.quickTestId ||
    quickTest?.testId ||
    quickTest?.resultId ||
    null
  );
}

function pollPath(body, id) {
  const quickTest = firstQuickTest(body);
  const link =
    quickTest?.apiUrl ||
    quickTest?.pollUrl ||
    quickTest?.resultApiUrl ||
    quickTest?._links?.self?.href ||
    quickTest?._links?.result?.href;

  if (typeof link === 'string') {
    return new URL(link, 'https://www.debugbear.com').pathname.replace(
      '/api/v1',
      ''
    );
  }

  return `/quickTest/${id}`;
}

function isDebugBearComplete(body) {
  const status = `${body.status || body.state || ''}`.toLowerCase();
  return (
    body.hasFinished === true ||
    status === 'complete' ||
    status === 'completed' ||
    Boolean(body.lighthouseResult) ||
    Boolean(body.metrics?.['performance.largestContentfulPaint'])
  );
}

function debugBearMetric(body, names) {
  for (const name of names) {
    const value =
      body.metrics?.[name] ||
      body.summary?.[name] ||
      body.lighthouseResult?.audits?.[name]?.numericValue;
    if (typeof value === 'number') return value;
  }
  return null;
}

function summarizeDebugBear(label, url, body) {
  return {
    cls: debugBearMetric(body, [
      'performance.cumulativeLayoutShift',
      'cumulativeLayoutShift',
      'cls',
    ]),
    fcpMs: debugBearMetric(body, [
      'performance.firstContentfulPaint',
      'firstContentfulPaint',
      'fcp',
    ]),
    label,
    lcpMs: debugBearMetric(body, [
      'performance.largestContentfulPaint',
      'largestContentfulPaint',
      'lcp',
    ]),
    source: 'debugbear',
    tbtMs: debugBearMetric(body, [
      'performance.totalBlockingTime',
      'totalBlockingTime',
      'tbt',
    ]),
    url,
  };
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}: ${text}`);
  }
  return body;
}

async function runPsi(route) {
  const url = new URL(
    'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
  );
  url.searchParams.set('url', route.url);
  url.searchParams.set('strategy', 'mobile');
  for (const category of [
    'performance',
    'accessibility',
    'best-practices',
    'seo',
  ]) {
    url.searchParams.append('category', category);
  }
  if (psiKey) {
    url.searchParams.set('key', psiKey);
  }

  const payload = await fetchJson(url);
  return {
    payload,
    summary: summarizePsi(route.label, payload),
  };
}

function debugBear(path, init = {}) {
  return fetchJson(`https://www.debugbear.com/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': debugBearApiKey,
      ...(init.headers || {}),
    },
  });
}

async function runDebugBear(route) {
  const created = await debugBear(`/project/${debugBearProjectId}/quickTests`, {
    body: JSON.stringify([
      { device: debugBearDevice, region: debugBearRegion, url: route.url },
    ]),
    method: 'POST',
  });
  const id = quickTestId(created);
  if (!id) {
    throw new Error('DebugBear quick test response did not include an id');
  }

  let result = created;
  const path = pollPath(created, id);
  for (let attempt = 0; attempt < debugBearMaxPollAttempts; attempt += 1) {
    result = await debugBear(path);
    if (isDebugBearComplete(result)) break;
    await new Promise((resolve) =>
      setTimeout(resolve, debugBearPollIntervalMs)
    );
  }

  return {
    payload: { created, result },
    summary: summarizeDebugBear(route.label, route.url, result),
  };
}

function printTable(rows) {
  const printable = rows.map((row) => ({
    route: row.label,
    source: row.source,
    perf: row.performance ?? '-',
    a11y: row.a11y ?? '-',
    bp: row.bp ?? '-',
    seo: row.seo ?? '-',
    lcp: row.lcpMs == null ? '-' : Math.round(row.lcpMs),
    fcp: row.fcpMs == null ? '-' : Math.round(row.fcpMs),
    tbt: row.tbtMs == null ? '-' : Math.round(row.tbtMs),
    cls: row.cls ?? '-',
  }));
  console.table(printable);
}

await mkdir(outputDir, { recursive: true });

const summaries = [];

for (const route of routes) {
  const psi = await runPsi(route);
  await writeFile(
    join(outputDir, `${auditId}-${route.label}-mobile-psi.json`),
    JSON.stringify(psi.payload, null, 2)
  );
  summaries.push(psi.summary);
}

if (debugBearProjectId && debugBearApiKey) {
  for (const route of routes) {
    const debugBearResult = await runDebugBear(route);
    await writeFile(
      join(outputDir, `${auditId}-${route.label}-debugbear.json`),
      JSON.stringify(debugBearResult.payload, null, 2)
    );
    summaries.push(debugBearResult.summary);
  }
}

await writeFile(
  join(outputDir, `${auditId}-ogabassey-critical-path-summary.json`),
  JSON.stringify(summaries, null, 2)
);

printTable(summaries);
console.log(`Saved raw audit artifacts to ${outputDir}`);
console.log(`Audit prefix: ${basename(auditId)}`);
