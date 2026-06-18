#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import searchQualityFixtures from '../../src/lib/search-quality/search-quality-fixtures.json' with {
  type: 'json',
};

const DEFAULT_ORIGIN = 'https://ogabassey.com';
const DEFAULT_OUT = 'output/search/ogabassey-search-baseline.json';
const REQUEST_HEADERS = { accept: 'text/html,application/json' };
const RESPONSE_SAMPLE_LIMIT = 1000;
const SURFACE_FETCH_TIMEOUT_MS = 30_000;

export const SEARCH_QUALITY_FIXTURES = searchQualityFixtures;

function buildSkippedSurface(reason) {
  return {
    ok: false,
    sample: reason,
    status: 0,
  };
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'unknown error';
}

async function fetchSurface({ fetchImpl, origin, path }) {
  try {
    const response = await fetchImpl(new URL(path, origin), {
      headers: REQUEST_HEADERS,
      signal: AbortSignal.timeout(SURFACE_FETCH_TIMEOUT_MS),
    });

    return {
      ok: response.ok,
      sample: (await response.text()).slice(0, RESPONSE_SAMPLE_LIMIT),
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      sample: `Fetch error: ${getErrorMessage(error)}`,
      status: 0,
    };
  }
}

async function fetchFixtureSurfaces({
  fetchImpl,
  fixture,
  merchantId,
  origin,
}) {
  const encoded = encodeURIComponent(fixture.query);
  const searchPage = await fetchSurface({
    fetchImpl,
    origin,
    path: `/search?q=${encoded}`,
  });

  if (!merchantId) {
    const skipped = buildSkippedSurface('OGABASSEY_MERCHANT_ID not set');

    return {
      apiSearch: skipped,
      autocomplete: skipped,
      searchPage,
      storefrontProducts: skipped,
    };
  }

  const merchantParam = encodeURIComponent(merchantId);

  return {
    apiSearch: await fetchSurface({
      fetchImpl,
      origin,
      path: `/api/search?q=${encoded}&merchant_id=${merchantParam}&limit=20`,
    }),
    autocomplete: await fetchSurface({
      fetchImpl,
      origin,
      path: `/api/search/autocomplete?q=${encoded}&merchant_id=${merchantParam}&limit=10`,
    }),
    searchPage,
    storefrontProducts: await fetchSurface({
      fetchImpl,
      origin,
      path: `/api/storefront/products?q=${encoded}&merchant_id=${merchantParam}&limit=20`,
    }),
  };
}

export async function createBaselineReport({
  fetchImpl = fetch,
  generatedAt = new Date().toISOString(),
  merchantId = '',
  origin = DEFAULT_ORIGIN,
} = {}) {
  const results = [];

  for (const fixture of SEARCH_QUALITY_FIXTURES) {
    results.push({
      fixture,
      surfaces: await fetchFixtureSurfaces({
        fetchImpl,
        fixture,
        merchantId,
        origin,
      }),
    });
  }

  return {
    generatedAt,
    origin,
    results,
  };
}

export async function writeBaselineReport({ out = DEFAULT_OUT, report }) {
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
}

async function run() {
  const out = process.env.OGABASSEY_SEARCH_BASELINE_OUT ?? DEFAULT_OUT;
  const report = await createBaselineReport({
    merchantId: process.env.OGABASSEY_MERCHANT_ID ?? '',
    origin: process.env.OGABASSEY_SEARCH_ORIGIN ?? DEFAULT_ORIGIN,
  });

  await writeBaselineReport({ out, report });
  console.log(`Wrote ${out}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
