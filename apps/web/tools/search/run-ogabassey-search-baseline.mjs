#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_ORIGIN = 'https://ogabassey.com';
const DEFAULT_OUT = 'output/search/ogabassey-search-baseline.json';
const REQUEST_HEADERS = { accept: 'text/html,application/json' };

export const SEARCH_QUALITY_FIXTURES = [
  { kind: 'exact', query: 'iphone', expectedTopProductNames: ['iPhone'] },
  {
    kind: 'exact',
    query: 'iphone 16 pro max',
    expectedTopProductNames: ['iPhone 16 Pro Max'],
  },
  {
    kind: 'exact',
    query: 'samsung s24',
    expectedTopProductNames: ['Samsung'],
  },
  { kind: 'typo', query: 'iphnoe', expectedTopProductNames: ['iPhone'] },
  { kind: 'typo', query: 'ipone', expectedTopProductNames: ['iPhone'] },
  { kind: 'typo', query: 'samung', expectedTopProductNames: ['Samsung'] },
  {
    kind: 'spec',
    query: '256gb iphone',
    expectedParsedFilters: { storageGb: 256 },
    expectedTopProductNames: ['iPhone'],
  },
  {
    kind: 'spec',
    query: 'dual sim iphone',
    expectedTopProductNames: ['iPhone'],
  },
  {
    kind: 'spec',
    query: 'esim iphone',
    expectedTopProductNames: ['iPhone'],
  },
  {
    kind: 'condition',
    query: 'used iphone',
    expectedParsedFilters: { condition: 'used' },
    expectedTopProductNames: ['iPhone'],
  },
  {
    kind: 'condition',
    query: 'refurbished iphone',
    expectedParsedFilters: { condition: 'open_box' },
    expectedTopProductNames: ['iPhone'],
  },
  {
    kind: 'condition',
    query: 'open box laptop',
    expectedParsedFilters: { condition: 'open_box' },
    expectedTopProductNames: ['Laptop'],
  },
  {
    kind: 'price-intent',
    query: 'phone under 500k',
    expectedParsedFilters: { maxPrice: 500000 },
    expectedTopProductNames: ['iPhone', 'Samsung'],
  },
  {
    kind: 'price-intent',
    query: 'laptop below 2m',
    expectedParsedFilters: { maxPrice: 2000000 },
    expectedTopProductNames: ['MacBook', 'Laptop'],
  },
  { kind: 'locale', query: 'iphóné', expectedTopProductNames: ['iPhone'] },
  { kind: 'locale', query: 'ṣamṣung', expectedTopProductNames: ['Samsung'] },
  {
    kind: 'agentic-parity',
    query: 'iphone 16 pro',
    expectedTopProductNames: ['iPhone 16 Pro'],
  },
  {
    kind: 'zero-results',
    query: 'nonexistent quantum gadget',
    expectedTopProductNames: [],
  },
];

function buildSkippedSurface(reason) {
  return {
    ok: false,
    sample: reason,
    status: 0,
  };
}

async function fetchSurface({ fetchImpl, origin, path }) {
  const response = await fetchImpl(new URL(path, origin), {
    headers: REQUEST_HEADERS,
  });

  return {
    ok: response.ok,
    sample: (await response.text()).slice(0, 1000),
    status: response.status,
  };
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
