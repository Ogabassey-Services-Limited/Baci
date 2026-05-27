import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const projectId = process.env.DEBUGBEAR_PROJECT_ID;
const apiKey = process.env.DEBUGBEAR_API_KEY;
const targetUrl =
  process.env.OGABASSEY_PDP_LCP_URL ||
  'https://ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090';
const device = process.env.DEBUGBEAR_DEVICE || 'Mobile';
const region = process.env.DEBUGBEAR_REGION || 'us-east';
const rawDir = process.env.DEBUGBEAR_RAW_DIR || '/tmp';

if (!projectId) throw new Error('DEBUGBEAR_PROJECT_ID is required');
if (!apiKey) throw new Error('DEBUGBEAR_API_KEY is required');

async function debugbear(path, init = {}) {
  const response = await fetch(`https://www.debugbear.com/api/v1${path}`, {
    ...init,
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`DebugBear ${response.status}: ${text}`);
  return body;
}

function firstQuickTest(body) {
  if (Array.isArray(body)) return body[0] || null;
  if (Array.isArray(body.quickTests)) return body.quickTests[0] || null;
  if (Array.isArray(body.tests)) return body.tests[0] || null;
  return body;
}

function getQuickTestId(body) {
  const quickTest = firstQuickTest(body);
  return (
    quickTest?.id ||
    quickTest?.quickTestId ||
    quickTest?.testId ||
    quickTest?.resultId ||
    null
  );
}

function getPollPath(body, quickTestId) {
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
  return `/quickTest/${quickTestId}`;
}

function isComplete(body) {
  const status = `${body.status || body.state || ''}`.toLowerCase();
  return (
    body.hasFinished === true ||
    status === 'complete' ||
    status === 'completed' ||
    Boolean(body.lighthouseResult) ||
    Boolean(body.metrics?.['performance.largestContentfulPaint'])
  );
}

function metric(body, names) {
  for (const name of names) {
    const value =
      body.metrics?.[name] ||
      body.summary?.[name] ||
      body.lighthouseResult?.audits?.[name]?.numericValue;
    if (typeof value === 'number') return value;
  }
  return null;
}

await mkdir(rawDir, { recursive: true });

const created = await debugbear(`/project/${projectId}/quickTests`, {
  method: 'POST',
  body: JSON.stringify([{ url: targetUrl, device, region }]),
});

const quickTestId = getQuickTestId(created);
await writeFile(
  join(rawDir, `debugbear-ogabassey-pdp-create-${Date.now()}.json`),
  JSON.stringify(created, null, 2)
);

if (!quickTestId) {
  console.log(JSON.stringify(created, null, 2));
  throw new Error('DebugBear response did not include a quick test id');
}

const pollPath = getPollPath(created, quickTestId);
let result = created;
for (let attempt = 0; attempt < 90; attempt += 1) {
  result = await debugbear(pollPath);
  if (isComplete(result)) break;
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

await writeFile(
  join(rawDir, `debugbear-ogabassey-pdp-result-${quickTestId}.json`),
  JSON.stringify(result, null, 2)
);

console.log(
  JSON.stringify(
    {
      quickTestId,
      url: targetUrl,
      device,
      region,
      lcpMs: metric(result, [
        'performance.largestContentfulPaint',
        'largestContentfulPaint',
        'lcp',
      ]),
      fcpMs: metric(result, [
        'performance.firstContentfulPaint',
        'firstContentfulPaint',
        'fcp',
      ]),
      tbtMs: metric(result, [
        'performance.totalBlockingTime',
        'totalBlockingTime',
        'tbt',
      ]),
      cls: metric(result, [
        'performance.cumulativeLayoutShift',
        'cumulativeLayoutShift',
        'cls',
      ]),
      resultUrl:
        result.url ||
        result.resultUrl ||
        `https://www.debugbear.com/project/${projectId}/quickTest/${quickTestId}/overview`,
    },
    null,
    2
  )
);
