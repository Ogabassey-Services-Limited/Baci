/**
 * VPS worker: run-web-cron
 * Calls retained CRON_SECRET-gated web cron endpoints from the VPS schedule.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { config } from 'dotenv';

// These paths expose CRON_SECRET-gated wrappers that delegate to the underlying
// scheduled work. The VPS worker must not call OAuth callbacks.
const WEB_CRON_CONFIG = new Map([
  ['/api/ai-jobs/worker', { method: 'GET', timeoutMs: 15 * 60_000 }],
  ['/api/cron/cleanup-orders', { method: 'GET', timeoutMs: 5 * 60_000 }],
  ['/api/cron/process-settlements', { method: 'POST', timeoutMs: 5 * 60_000 }],
  [
    '/api/cron/publish-scheduled-posts',
    { method: 'GET', timeoutMs: 5 * 60_000 },
  ],
  ['/api/cron/wallet-payouts', { method: 'GET', timeoutMs: 5 * 60_000 }],
  ['/api/inventory/push-alerts', { method: 'GET', timeoutMs: 10 * 60_000 }],
]);

const RESPONSE_PREVIEW_LIMIT = 500;
const DEFAULT_TIMEOUT_MS = 30_000;

function readTimeoutMs(value, fallbackMs = DEFAULT_TIMEOUT_MS) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallbackMs;
}

function formatBodyPreview(body) {
  if (body.length <= RESPONSE_PREVIEW_LIMIT) {
    return body;
  }
  return `${body.slice(0, RESPONSE_PREVIEW_LIMIT)}... [truncated]`;
}

function throwWebCronRequestError({ error, path, timeoutMs }) {
  if (error instanceof Error && /abort|timeout/i.test(error.name)) {
    throw new Error(`Web cron ${path} timed out after ${timeoutMs}ms`);
  }
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`Web cron ${path} request failed: ${message}`);
}

function getWebCronConfig(path) {
  const webCronConfig = WEB_CRON_CONFIG.get(path);
  if (!webCronConfig) {
    throw new Error(`Unsupported web cron path: ${path || '(empty)'}`);
  }
  return webCronConfig;
}

function buildWebCronRequest({ baseUrl, path }) {
  if (!baseUrl) {
    throw new Error('BACI_WEB_BASE_URL is required');
  }
  const webCronConfig = getWebCronConfig(path);

  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (url.protocol !== 'https:') {
    throw new Error('BACI_WEB_BASE_URL must use https');
  }
  if (url.username || url.password) {
    throw new Error('BACI_WEB_BASE_URL must not contain credentials');
  }

  return { url: url.toString(), webCronConfig };
}

export function buildWebCronUrl({ baseUrl, path }) {
  return buildWebCronRequest({ baseUrl, path }).url;
}

export async function runWebCron({
  path,
  env = process.env,
  fetchFn = fetch,
  logger = console,
}) {
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error('CRON_SECRET is required');
  }
  if (typeof fetchFn !== 'function') {
    throw new Error('A fetch implementation is required');
  }

  const { url, webCronConfig } = buildWebCronRequest({
    baseUrl: env.BACI_WEB_BASE_URL,
    path,
  });
  const timeoutMs = readTimeoutMs(
    env.BACI_WEB_CRON_TIMEOUT_MS,
    webCronConfig.timeoutMs
  );
  const headers = {
    Authorization: `Bearer ${cronSecret}`,
    'User-Agent': 'baci-vps-web-cron/1.0',
  };
  let response;
  try {
    response = await fetchFn(url, {
      method: webCronConfig.method,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throwWebCronRequestError({ error, path, timeoutMs });
  }
  let body;
  try {
    body = await response.text();
  } catch (error) {
    throwWebCronRequestError({ error, path, timeoutMs });
  }

  if (!response.ok) {
    const preview = formatBodyPreview(body);
    throw new Error(
      `Web cron ${path} failed with HTTP ${response.status}: ${preview}`
    );
  }

  logger.log(`[run-web-cron] ${path} completed with HTTP ${response.status}`);
  return { status: response.status, body };
}

async function main() {
  config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

  const path = process.argv[2];
  if (!path) {
    console.error('[run-web-cron] Usage: node jobs/run-web-cron.mjs <path>');
    process.exit(1);
  }

  try {
    await runWebCron({ path });
  } catch (error) {
    console.error('[run-web-cron] Worker failed:', error);
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
