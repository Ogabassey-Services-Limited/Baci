import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_ROUNDS = 2;
const DEFAULT_DELAY_MS = 2_000;

function getRepoRoot() {
  try {
    return fileURLToPath(new URL('../../../..', import.meta.url));
  } catch {
    return process.cwd().endsWith('/apps/web')
      ? join(process.cwd(), '../..')
      : process.cwd();
  }
}

export const DEFAULT_CACHE_PROBE_ROUTES = [
  {
    expectCloudflareCache: true,
    label: 'blog-index',
    url: 'https://ogabassey.com/blog',
  },
  {
    expectCloudflareCache: true,
    label: 'blog-post',
    url: 'https://ogabassey.com/blog/the-ultimate-checklist-for-buying-a-used-iphone-in-2025',
  },
  {
    expectCloudflareCache: true,
    label: 'category-smartphones',
    url: 'https://ogabassey.com/smartphones',
  },
  {
    expectCloudflareCache: true,
    label: 'categoryless-pdp',
    url: 'https://ogabassey.com/products/samsung-galaxy-z-fold-4',
  },
  {
    expectCloudflareCache: false,
    label: 'unknown-single-segment',
    url: 'https://ogabassey.com/steam-deck',
  },
];

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toRoute(value, index) {
  const separatorIndex = value.indexOf('=');
  if (separatorIndex === -1 || /^https?:\/\//i.test(value)) {
    return {
      expectCloudflareCache: true,
      label: `route-${index + 1}`,
      url: value,
    };
  }

  return {
    expectCloudflareCache: true,
    label: value.slice(0, separatorIndex),
    url: value.slice(separatorIndex + 1),
  };
}

export function getCacheProbeRoutesFromEnv(env = process.env) {
  const rawRoutes = env.OGABASSEY_CACHE_PROBE_URLS;
  if (!rawRoutes) {
    return DEFAULT_CACHE_PROBE_ROUTES;
  }

  return rawRoutes
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(toRoute);
}

export function getCacheProbeConfig(env = process.env) {
  return {
    delayMs: numberFromEnv(
      env.OGABASSEY_CACHE_PROBE_DELAY_MS,
      DEFAULT_DELAY_MS
    ),
    outputDir:
      env.OGABASSEY_CACHE_PROBE_OUTPUT_DIR ||
      join(getRepoRoot(), 'output/audits'),
    rounds: Math.max(
      1,
      Math.trunc(
        numberFromEnv(env.OGABASSEY_CACHE_PROBE_ROUNDS, DEFAULT_ROUNDS)
      )
    ),
    timeoutMs: numberFromEnv(
      env.OGABASSEY_CACHE_PROBE_TIMEOUT_MS,
      DEFAULT_FETCH_TIMEOUT_MS
    ),
  };
}

function getHeader(headers, name) {
  return headers.get(name) || null;
}

async function wait(ms) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function probeCacheRoute(route, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || (() => performance.now());
  const timestamp = options.timestamp || (() => new Date().toISOString());
  const timeoutMs = options.timeoutMs || DEFAULT_FETCH_TIMEOUT_MS;
  const startMs = now();

  const response = await fetchImpl(route.url, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'OgabasseyCacheProbe/1.0',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const headersMs = now();
  const body = await response.arrayBuffer();
  const doneMs = now();

  return {
    age: getHeader(response.headers, 'age'),
    bytes: body.byteLength,
    cacheStatus: getHeader(response.headers, 'cf-cache-status'),
    contentType: getHeader(response.headers, 'content-type'),
    expectCloudflareCache: route.expectCloudflareCache,
    finalUrl: response.url || route.url,
    label: route.label,
    ok: response.ok,
    round: options.round || 1,
    serverTiming: getHeader(response.headers, 'server-timing'),
    status: response.status,
    timestamp: timestamp(),
    totalMs: Math.round(doneMs - startMs),
    ttfbMs: Math.round(headersMs - startMs),
    url: route.url,
    vercelCache: getHeader(response.headers, 'x-vercel-cache'),
  };
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function failedProbeResult(route, error, options = {}) {
  const timestamp = options.timestamp || (() => new Date().toISOString());

  return {
    age: null,
    bytes: 0,
    cacheStatus: null,
    contentType: null,
    error: getErrorMessage(error),
    expectCloudflareCache: route.expectCloudflareCache,
    finalUrl: route.url,
    label: route.label,
    ok: false,
    round: options.round || 1,
    serverTiming: null,
    status: 0,
    timestamp: timestamp(),
    totalMs: null,
    ttfbMs: null,
    url: route.url,
    vercelCache: null,
  };
}

function summarizeResults(results) {
  return results.map((result) => ({
    age: result.age || '-',
    cache: result.cacheStatus || '-',
    label: result.label,
    round: result.round,
    status: result.status,
    totalMs: result.totalMs,
    ttfbMs: result.ttfbMs,
  }));
}

export async function runCacheProbe(options = {}) {
  const config = {
    ...getCacheProbeConfig(options.env),
    ...options,
  };
  const routes = config.routes || getCacheProbeRoutesFromEnv(options.env);
  const results = [];

  for (let round = 1; round <= config.rounds; round += 1) {
    for (const route of routes) {
      const probeOptions = {
        fetchImpl: config.fetchImpl,
        now: config.now,
        round,
        timeoutMs: config.timeoutMs,
        timestamp: config.timestamp,
      };

      try {
        results.push(await probeCacheRoute(route, probeOptions));
      } catch (error) {
        results.push(failedProbeResult(route, error, probeOptions));
      }
    }

    if (round < config.rounds) {
      await wait(config.delayMs);
    }
  }

  const auditId = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = join(
    config.outputDir,
    `${auditId}-ogabassey-cache-probe.jsonl`
  );
  await mkdir(config.outputDir, { recursive: true });
  await writeFile(
    outputPath,
    `${results.map((result) => JSON.stringify(result)).join('\n')}\n`
  );

  return {
    outputPath,
    results,
    summary: summarizeResults(results),
  };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const { outputPath, results, summary } = await runCacheProbe();
  console.table(summary);
  console.log(`Wrote ${results.length} cache probe rows to ${outputPath}`);
}
