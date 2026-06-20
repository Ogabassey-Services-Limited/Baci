# Ogabassey Search 2026 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Ogabassey storefront search from a good Postgres lexical search to a 2026 best-in-segment Supabase-native commerce search across web, mobile, autocomplete, agentic catalog, MCP, and AI chat commerce surfaces.

**Architecture:** Keep the existing Postgres/Supabase foundation and make `search_products_v2` the shared ranking contract before adding heavier capabilities. Phase P0 fixes correctness, locale normalization, autocomplete divergence, and agentic parity. Phase P1 adds query understanding, facets, no-results recovery, analytics, and merchant merchandising. Phase P2 adds a measured pgvector hybrid-search experiment after P0/P1 quality and latency gates pass.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod, Supabase Postgres, `pg_trgm`, `unaccent`, existing pgvector embeddings, Vitest, Jest, React, React Native, MCP/UCP agentic catalog routes, AI chat tool handlers.

---

## Source Inputs

- Current code inspection found strong foundations in `apps/web/src/lib/storefront-search.ts` and `public.search_products_v2`: full-text search, trigram similarity, SKU/name/brand/category boosts, stock/popularity boosts, merchant scoping, and GIN indexes.
- Current code inspection found divergence in `apps/web/src/app/api/search/autocomplete/route.ts`, `apps/web/src/app/api/storefront/products/route.ts`, `apps/web/src/app/api/agentic/catalog/search/route.ts`, `apps/web/src/ai/chat-tool-handlers.ts`, and `apps/web/mcp-server/server.ts`, where search still uses simpler `ilike` paths.
- Current code inspection found the Gemini and Ollama chat runtimes call `handleSearchProducts` from `apps/web/src/ai/chat-tool-handlers.ts`; Task 6 must migrate or explicitly gate that path, not only the UCP catalog route and MCP server.
- Live probes on 2026-06-17 showed `https://ogabassey.com/search?q=iphone` returns products, `https://ogabassey.com/search?q=iphnoe` dead-ends, and `https://ogabassey.com/search?q=phone%20under%20500k` returns phone-like results without applying a price-intent constraint.
- The second agent's research workflow agreed with the conclusion: keep the Postgres-native approach, but close semantic, locale, autocomplete, agentic, faceting, and merchandising gaps.

## Scope Split

This is a master implementation plan. Execute it in phases:

- **P0 branch:** Tasks 1 through 7. This branch must ship independently and improve correctness without semantic search.
- **P1 branch:** Tasks 8 through 11. This branch adds user-facing search UX and merchant controls after P0 lands.
- **P2 experiment branch:** Task 12. This branch is a measured pgvector hybrid-search experiment with explicit stop rules.

Do not start P1 before P0 is merged. Do not start P2 before P1 has production search analytics and a baseline quality report.

## Repo Rules For Execution

- Start execution from a clean worktree created from current `origin/main`.
- Use a branch name like `codex/ogabassey-search-p0`.
- Do not edit existing migration files in `supabase/migrations/`.
- Do not touch `apps/web/src/proxy.ts`.
- Do not use service-role/admin clients for customer-facing search paths.
- Keep Ogabassey validation merchant-scoped. If test fixtures use multiple merchants, assert that cross-merchant results do not leak.
- Use TDD for each task: failing test, implementation, passing test, commit.
- Run the full gate before each phase handoff:

```bash
pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test
coderabbit review --prompt-only -t uncommitted
```

## Local SQL Test Runner

Do not assume `SUPABASE_DB_URL` exists in the shell. For every local SQL-test step after `supabase db reset`, derive the local database URL from Supabase CLI output:

```bash
LOCAL_DB_URL="$(supabase status -o env | awk -F= '/^DB_URL=/{print $2}')"
test -n "$LOCAL_DB_URL"
psql "$LOCAL_DB_URL" -f path/to/test.sql
```

Stop if `LOCAL_DB_URL` is empty; that means the local Supabase stack is not reporting a database URL and the SQL verification is not valid.

## File Structure

### Create

| File | Responsibility |
|---|---|
| `apps/web/src/lib/search-quality/search-quality-fixtures.ts` | Shared search-quality fixture set for exact, typo, spec, price, locale, and agentic parity checks. |
| `apps/web/src/lib/search-quality/search-quality-fixtures.test.ts` | Locks fixture shape and prevents accidental removal of critical query classes. |
| `apps/web/tools/search/run-ogabassey-search-baseline.mjs` | Reproducible public live/local probe runner for `/search`, `/api/search`, autocomplete, and storefront products. Authenticated UCP catalog, MCP, and AI chat parity are verified by Task 6 tests instead of this public probe script. |
| `apps/web/src/lib/storefront-search-autocomplete.ts` | Adapter that maps the shared ranked search contract into autocomplete payloads. |
| `apps/web/src/lib/storefront-search-autocomplete.test.ts` | Unit tests for ranked autocomplete mapping, short-query behavior, and no popular-search scans. |
| `supabase/migrations/20260617120000_product_search_locale_normalization.sql` | Append-only unaccent/normalization/index migration. |
| `supabase/migrations/tests/product_search_locale_normalization.sql` | SQL regression tests for accent-insensitive search and function search-path safety. |
| `apps/web/src/lib/search-query-intent.ts` | Deterministic parser for price/storage/condition/spec intent. |
| `apps/web/src/lib/search-query-intent.test.ts` | Unit tests for `under 500k`, `below 2m`, `256gb`, `dual sim`, `used`, `open_box`/`refurbished`, and brand/model terms. |
| `supabase/migrations/20260617122000_storefront_search_analytics_aggregates.sql` | Service-refreshed search-query rollups for merchant dashboards; not part of the search hot path. |
| `supabase/migrations/tests/storefront_search_analytics_aggregates.sql` | SQL tests for rollup RLS, service-only refresh grants, and blank search path. |
| `supabase/migrations/20260617123000_storefront_search_merchandising.sql` | Append-only merchant-scoped synonyms, boost, pin, and hide tables with RLS. |
| `supabase/migrations/tests/storefront_search_merchandising.sql` | SQL tests for merchant-scoped rule visibility and ranking inputs. |
| `docs/superpowers/specs/2026-06-17-ogabassey-hybrid-search-experiment.md` | P2 experiment spec for measured pgvector/lexical hybrid search. |
| `apps/web/mcp-server/search-products-ranking.ts` | Shared MCP helper for `search_products_v2` RPC arguments and ranked row ordering. |
| `apps/web/mcp-server/search-products-ranking.test.ts` | Unit coverage for MCP ranked-search RPC args and ranked ordering. |

### Modify

| File | Responsibility |
|---|---|
| `apps/web/src/lib/storefront-search.ts` | Shared ranking contract for web, autocomplete, storefront product API, mobile-compatible API responses, and agentic adapters. Also owns analytics opt-out for autocomplete. |
| `apps/web/src/lib/storefront-search.test.ts` | Expand RPC argument, ranking, pagination, suggestion, and merchant-isolation coverage. |
| `apps/web/src/app/api/search/autocomplete/route.ts` | Replace parallel `ilike` backend with ranked autocomplete adapter while keeping `popularSearches: []`; do not reintroduce the expensive `popular_searches` view. |
| `apps/web/src/app/api/search/search-security.test.ts` | Update autocomplete route security tests for the ranked adapter, stable response shape, invalid inputs, timeout fallback, and no legacy raw PostgREST text filters. |
| `apps/web/src/components/storefront/search-autocomplete.test.tsx` | Add ranked ordering, typo result, and clear/no-result coverage. |
| `apps/web/src/app/api/storefront/products/route.ts` | Route `q` queries through shared ranked search instead of `name/description ilike`. |
| `apps/web/src/app/api/storefront/products/route.test-helpers.ts` | Extend the existing route test harness so the q-ranked path can mock both RPC ranking and product-row hydration. |
| `apps/web/src/app/api/storefront/products/route.test.ts` | Add q-ranked order, typo, and merchant isolation tests. |
| `apps/web/src/components/storefront/ogabassey/components/comparison-product-search.test.ts` | Expand coverage for typo and same-merchant filtering. |
| `apps/web/src/app/api/agentic/catalog/search/route.ts` | Replace agentic `ilike` retrieval with shared ranked search. |
| `apps/web/src/app/api/agentic/catalog/search/route.test.ts` | Add parity tests with storefront ranked IDs. |
| `apps/web/src/ai/chat-tool-handlers.ts` | Route the AI chat `searchProducts` handler through the shared ranked search contract, hydrate ranked product IDs, and preserve price/category behavior without legacy PostgREST OR filters. |
| `apps/web/src/ai/chat-tool-handlers.test.ts` | Replace legacy `.or(...ilike...)` expectations with shared-ranked-search, hydration, order-preservation, price-filter, category-only, and injection-regression coverage. |
| `apps/web/mcp-server/server.ts` | Route `search_products` through `search_products_v2` RPC or a local adapter with the same arguments. |
| `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/search/search-page-content.tsx` | Add search box, clickable did-you-mean, facets/sort/pagination, and stronger no-results recovery. |
| `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/search/search-page-content.test.tsx` | Add UX coverage for filters, pagination, did-you-mean link, and no-results recovery. |
| `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/search/page.tsx` | Preserve metadata and canonical/noindex behavior with query/filter params. |
| `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/search/page.test.tsx` | Add metadata characterization coverage proving filter, sort, and pagination params stay noindexed and collapse canonical to the sanitized query. |
| `docs/AI_VECTOR_ARCHITECTURE.md` | Link to the P2 hybrid-search experiment and correct the product-vector target to `public.products.content_embedding`. |

---

## Task 0: Start Execution Worktree

**Files:** none.

- [ ] **Step 1: Create a fresh branch/worktree**

```bash
git fetch origin
git worktree add -b codex/ogabassey-search-p0 /tmp/baci-ogabassey-search-p0 origin/main
cd /tmp/baci-ogabassey-search-p0
pnpm install --frozen-lockfile
```

Expected: worktree is on `codex/ogabassey-search-p0` and install succeeds.

- [ ] **Step 2: Copy this plan into the worktree if execution is outside `/Users/mac/Baci-app`**

```bash
mkdir -p docs/superpowers/plans
cp /Users/mac/Baci-app/docs/superpowers/plans/2026-06-17-ogabassey-search-2026-upgrade.md docs/superpowers/plans/
```

Expected: the plan exists at `docs/superpowers/plans/2026-06-17-ogabassey-search-2026-upgrade.md`.

- [ ] **Step 3: Commit the copied plan if it was not already committed**

```bash
git add docs/superpowers/plans/2026-06-17-ogabassey-search-2026-upgrade.md
git commit -m "docs: add Ogabassey search upgrade plan"
```

Expected: either a docs commit is created, or Git reports nothing to commit because the plan already exists in the branch.

---

## Task 1: Search Quality Fixtures And Baseline Runner

**Files:**
- Create: `apps/web/src/lib/search-quality/search-quality-fixtures.ts`
- Create: `apps/web/src/lib/search-quality/search-quality-fixtures.test.ts`
- Create: `apps/web/tools/search/run-ogabassey-search-baseline.mjs`

- [ ] **Step 1: Write the failing fixture test**

Create `apps/web/src/lib/search-quality/search-quality-fixtures.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SEARCH_QUALITY_FIXTURES } from './search-quality-fixtures';

describe('SEARCH_QUALITY_FIXTURES', () => {
  it('covers the required search quality classes', () => {
    const classes = new Set(SEARCH_QUALITY_FIXTURES.map((fixture) => fixture.kind));

    expect(classes).toEqual(
      new Set([
        'exact',
        'typo',
        'spec',
        'condition',
        'price-intent',
        'locale',
        'agentic-parity',
        'zero-results',
      ])
    );
  });

  it('keeps typo and price-intent fixtures actionable', () => {
    expect(
      SEARCH_QUALITY_FIXTURES.some(
        (fixture) => fixture.query === 'iphnoe' && fixture.expectedTopProductNames.includes('iPhone')
      )
    ).toBe(true);

    expect(
      SEARCH_QUALITY_FIXTURES.some(
        (fixture) =>
          fixture.query === 'phone under 500k' &&
          fixture.expectedParsedFilters?.maxPrice === 500_000
      )
    ).toBe(true);
  });

  it('keeps open box and refurbished condition fixtures actionable', () => {
    expect(
      SEARCH_QUALITY_FIXTURES.some(
        (fixture) =>
          fixture.query === 'refurbished iphone' &&
          fixture.expectedParsedFilters?.condition === 'open_box'
      )
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run the fixture test and verify it fails**

```bash
pnpm --filter @baci/web exec vitest run src/lib/search-quality/search-quality-fixtures.test.ts
```

Expected: FAIL because `search-quality-fixtures.ts` does not exist.

- [ ] **Step 3: Create the fixtures**

Create `apps/web/src/lib/search-quality/search-quality-fixtures.ts`:

```ts
export type SearchQualityFixtureKind =
  | 'exact'
  | 'typo'
  | 'spec'
  | 'condition'
  | 'price-intent'
  | 'locale'
  | 'agentic-parity'
  | 'zero-results';

export interface SearchQualityFixture {
  kind: SearchQualityFixtureKind;
  query: string;
  expectedTopProductNames: string[];
  expectedParsedFilters?: {
    minPrice?: number;
    maxPrice?: number;
    storageGb?: number;
    condition?: 'new' | 'used' | 'open_box';
  };
}

export const SEARCH_QUALITY_FIXTURES: SearchQualityFixture[] = [
  { kind: 'exact', query: 'iphone', expectedTopProductNames: ['iPhone'] },
  { kind: 'exact', query: 'iphone 16 pro max', expectedTopProductNames: ['iPhone 16 Pro Max'] },
  { kind: 'exact', query: 'samsung s24', expectedTopProductNames: ['Samsung'] },
  { kind: 'typo', query: 'iphnoe', expectedTopProductNames: ['iPhone'] },
  { kind: 'typo', query: 'ipone', expectedTopProductNames: ['iPhone'] },
  { kind: 'typo', query: 'samung', expectedTopProductNames: ['Samsung'] },
  { kind: 'spec', query: '256gb iphone', expectedTopProductNames: ['iPhone'], expectedParsedFilters: { storageGb: 256 } },
  { kind: 'spec', query: 'dual sim iphone', expectedTopProductNames: ['iPhone'] },
  { kind: 'spec', query: 'esim iphone', expectedTopProductNames: ['iPhone'] },
  { kind: 'condition', query: 'refurbished iphone', expectedTopProductNames: ['iPhone'], expectedParsedFilters: { condition: 'open_box' } },
  { kind: 'condition', query: 'open box laptop', expectedTopProductNames: ['Laptop'], expectedParsedFilters: { condition: 'open_box' } },
  { kind: 'price-intent', query: 'phone under 500k', expectedTopProductNames: ['iPhone', 'Samsung'], expectedParsedFilters: { maxPrice: 500_000 } },
  { kind: 'price-intent', query: 'laptop below 2m', expectedTopProductNames: ['MacBook', 'Laptop'], expectedParsedFilters: { maxPrice: 2_000_000 } },
  { kind: 'locale', query: 'iphóné', expectedTopProductNames: ['iPhone'] },
  { kind: 'locale', query: 'ṣamṣung', expectedTopProductNames: ['Samsung'] },
  { kind: 'agentic-parity', query: 'iphone 16 pro', expectedTopProductNames: ['iPhone 16 Pro'] },
  { kind: 'zero-results', query: 'nonexistent quantum gadget', expectedTopProductNames: [] },
];
```

- [ ] **Step 4: Create the baseline runner**

Create `apps/web/tools/search/run-ogabassey-search-baseline.mjs`:

This runner is intentionally public-surface only. Do not call `/api/agentic/catalog/search`, the MCP endpoint, or `/api/chat` from this script: UCP catalog search requires a bearer token and request-control headers, MCP runs as a separate server, and chat search can invoke LLM/tool-runtime paths. Task 6 owns those parity checks with targeted tests.

```js
#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const origin = process.env.OGABASSEY_SEARCH_ORIGIN ?? 'https://ogabassey.com';
const merchantId = process.env.OGABASSEY_MERCHANT_ID ?? '';
const out = process.env.OGABASSEY_SEARCH_BASELINE_OUT ?? 'output/search/ogabassey-search-baseline.json';
const SEARCH_QUALITY_FIXTURES = [
  { kind: 'exact', query: 'iphone', expectedTopProductNames: ['iPhone'] },
  { kind: 'exact', query: 'iphone 16 pro max', expectedTopProductNames: ['iPhone 16 Pro Max'] },
  { kind: 'exact', query: 'samsung s24', expectedTopProductNames: ['Samsung'] },
  { kind: 'typo', query: 'iphnoe', expectedTopProductNames: ['iPhone'] },
  { kind: 'typo', query: 'ipone', expectedTopProductNames: ['iPhone'] },
  { kind: 'typo', query: 'samung', expectedTopProductNames: ['Samsung'] },
  { kind: 'spec', query: '256gb iphone', expectedTopProductNames: ['iPhone'], expectedParsedFilters: { storageGb: 256 } },
  { kind: 'spec', query: 'dual sim iphone', expectedTopProductNames: ['iPhone'] },
  { kind: 'spec', query: 'esim iphone', expectedTopProductNames: ['iPhone'] },
  { kind: 'price-intent', query: 'phone under 500k', expectedTopProductNames: ['iPhone', 'Samsung'], expectedParsedFilters: { maxPrice: 500_000 } },
  { kind: 'price-intent', query: 'laptop below 2m', expectedTopProductNames: ['MacBook', 'Laptop'], expectedParsedFilters: { maxPrice: 2_000_000 } },
  { kind: 'locale', query: 'iphóné', expectedTopProductNames: ['iPhone'] },
  { kind: 'locale', query: 'ṣamṣung', expectedTopProductNames: ['Samsung'] },
  { kind: 'agentic-parity', query: 'iphone 16 pro', expectedTopProductNames: ['iPhone 16 Pro'] },
  { kind: 'zero-results', query: 'nonexistent quantum gadget', expectedTopProductNames: [] },
];

async function fetchText(path) {
  const response = await fetch(new URL(path, origin), { headers: { accept: 'text/html,application/json' } });
  return {
    ok: response.ok,
    status: response.status,
    text: await response.text(),
  };
}

async function run() {
  const results = [];

  for (const fixture of SEARCH_QUALITY_FIXTURES) {
    const encoded = encodeURIComponent(fixture.query);
    const surfaces = {
      searchPage: await fetchText(`/search?q=${encoded}`),
      apiSearch: merchantId
        ? await fetchText(`/api/search?q=${encoded}&merchant_id=${merchantId}&limit=20`)
        : { ok: false, status: 0, text: 'OGABASSEY_MERCHANT_ID not set' },
      autocomplete: merchantId
        ? await fetchText(`/api/search/autocomplete?q=${encoded}&merchant_id=${merchantId}&limit=10`)
        : { ok: false, status: 0, text: 'OGABASSEY_MERCHANT_ID not set' },
      storefrontProducts: merchantId
        ? await fetchText(`/api/storefront/products?q=${encoded}&merchant_id=${merchantId}&limit=20`)
        : { ok: false, status: 0, text: 'OGABASSEY_MERCHANT_ID not set' },
    };

    results.push({
      fixture,
      surfaces: Object.fromEntries(
        Object.entries(surfaces).map(([name, surface]) => [
          name,
          {
            ok: surface.ok,
            status: surface.status,
            sample: surface.text.slice(0, 1000),
          },
        ])
      ),
    });
  }

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify({ origin, generatedAt: new Date().toISOString(), results }, null, 2));
  console.log(`Wrote ${out}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 5: Run tests and baseline command**

```bash
pnpm --filter @baci/web exec vitest run src/lib/search-quality/search-quality-fixtures.test.ts
node apps/web/tools/search/run-ogabassey-search-baseline.mjs
```

Expected: test PASS. Baseline command writes JSON. It may mark API surfaces missing merchant id unless `OGABASSEY_MERCHANT_ID` is set.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/search-quality apps/web/tools/search/run-ogabassey-search-baseline.mjs
git commit -m "test(search): add Ogabassey search quality fixtures"
```

---

## Task 2: Expand The Shared Storefront Search Contract

**Files:**
- Modify: `apps/web/src/lib/storefront-search.ts`
- Modify: `apps/web/src/lib/storefront-search.test.ts`

- [ ] **Step 1: Write failing tests for filter-aware RPC arguments**

Append to `apps/web/src/lib/storefront-search.test.ts`:

```ts
it('passes optional filter and pagination arguments to search_products_v2', async () => {
  mockSupabase.rpc.mockResolvedValueOnce({
    data: [{ product_id: 'prod-1', total_count: 1 }],
    error: null,
  });

  await searchStorefrontProducts({
    supabase: mockSupabase as never,
    merchantId: '123e4567-e89b-12d3-a456-426614174000',
    query: 'iphone',
    limit: 12,
    offset: 24,
    filters: {
      brand: 'Apple',
      categoryId: '22222222-2222-2222-2222-222222222222',
      condition: 'used',
      minPrice: 100000,
      maxPrice: 500000,
      minRating: 4,
      stock: 'in_stock',
    },
    sort: 'price_asc',
  });

  expect(mockSupabase.rpc).toHaveBeenCalledWith(
    'search_products_v2',
    expect.objectContaining({
      brand_filter: 'Apple',
      category_id_filter: '22222222-2222-2222-2222-222222222222',
      condition_filter: 'used',
      max_price_filter: 500000,
      min_price_filter: 100000,
      min_rating_filter: 4,
      result_limit: 12,
      result_offset: 24,
      sort_by: 'price_asc',
      stock_filter: 'in_stock',
    })
  );
});

it('clamps result limits before calling the rpc', async () => {
  mockSupabase.rpc.mockResolvedValueOnce({
    data: [{ product_id: 'prod-1', total_count: 1 }],
    error: null,
  });

  await searchStorefrontProducts({
    supabase: mockSupabase as never,
    merchantId: '123e4567-e89b-12d3-a456-426614174000',
    query: 'iphone',
    limit: 500,
  });

  expect(mockSupabase.rpc).toHaveBeenCalledWith(
    'search_products_v2',
    expect.objectContaining({ result_limit: 100 })
  );
});

it('can disable analytics for autocomplete-style callers', async () => {
  mockSupabase.rpc.mockResolvedValueOnce({
    data: [{ product_id: 'prod-1', total_count: 1 }],
    error: null,
  });

  await searchStorefrontProducts({
    supabase: mockSupabase as never,
    merchantId: '123e4567-e89b-12d3-a456-426614174000',
    query: 'iphone',
    limit: 10,
    trackAnalytics: false,
  });

  expect(createPublicClient).not.toHaveBeenCalledWith({
    clientInfo: 'baci-storefront-search-analytics',
  });
  expect(mockAnalyticsSupabase.from).not.toHaveBeenCalledWith('search_analytics');
});

it('applies storefront condition-family filters after hydrating ranked results', async () => {
  const rpc = vi.fn().mockResolvedValue({
    data: [
      { product_id: 'product-1', total_count: 2 },
      { product_id: 'product-2', total_count: 2 },
    ],
    error: null,
  });

  vi.mocked(createClient).mockReturnValue({
    rpc,
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  } as never);

  vi.mocked(createPublicClient)
    .mockReturnValueOnce({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'product-1',
                    name: 'Phone Offer Family',
                    price: 1000,
                    slug: 'phone-offer-family',
                    condition: 'new',
                    has_condition_offers: true,
                    available_conditions: ['new', 'open_box'],
                  },
                  {
                    id: 'product-2',
                    name: 'New Only Phone',
                    price: 2000,
                    slug: 'new-only-phone',
                    condition: 'new',
                    has_condition_offers: false,
                    available_conditions: ['new'],
                  },
                ],
                error: null,
              }),
            })),
          })),
        })),
      })),
    } as never)
    .mockReturnValueOnce(mockAnalyticsSupabase as never);

  const result = await getStorefrontSearchProducts({
    merchantId: '123e4567-e89b-12d3-a456-426614174000',
    query: 'phone',
    limit: 20,
    filters: { condition: 'open_box' },
  });

  expect(rpc).toHaveBeenCalledWith(
    'search_products_v2',
    expect.objectContaining({
      condition_filter: null,
      result_limit: 100,
      result_offset: 0,
    })
  );
  expect(result.products.map((product) => product.id)).toEqual(['product-1']);
  expect(result.productIds).toEqual(['product-1']);
  expect(result.count).toBe(1);
});
```

Place the condition-family test inside the existing `describe('getStorefrontSearchProducts', ...)` block so it shares the same cookie and hydration setup as the ranked-order test.

- [ ] **Step 2: Run the tests and verify they fail**

```bash
pnpm --filter @baci/web exec vitest run src/lib/storefront-search.test.ts -t "filter and pagination|clamps|disable analytics|condition-family"
```

Expected: FAIL because `offset`, `filters`, `sort`, `trackAnalytics`, and post-hydration condition-family filtering are not supported.

- [ ] **Step 3: Add typed search options**

Modify `apps/web/src/lib/storefront-search.ts` by expanding the argument types and RPC call:

```ts
export type StorefrontSearchSort =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'popular'
  | 'newest';

export type StorefrontSearchStockFilter = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface StorefrontSearchFilters {
  brand?: string | null;
  categoryId?: string | null;
  condition?: string | null;
  maxPrice?: number | null;
  minPrice?: number | null;
  minRating?: number | null;
  stock?: StorefrontSearchStockFilter | null;
}

interface SearchStorefrontProductsArgs {
  supabase: StorefrontSearchSupabase;
  analyticsSupabase?: StorefrontSearchAnalyticsSupabase;
  merchantId: string;
  query: string;
  limit: number;
  offset?: number;
  filters?: StorefrontSearchFilters;
  sort?: StorefrontSearchSort;
  trackAnalytics?: boolean;
}

function clampSearchLimit(limit: number) {
  return Math.min(Math.max(Math.trunc(limit || 20), 1), 100);
}

function normalizeSearchOffset(offset?: number) {
  return Math.max(Math.trunc(offset || 0), 0);
}

export function toStorefrontSearchSort(sort?: string | null): StorefrontSearchSort {
  const sortMap: Record<string, StorefrontSearchSort> = {
    newest: 'newest',
    popular: 'popular',
    'price-asc': 'price_asc',
    'price-desc': 'price_desc',
    price_asc: 'price_asc',
    price_desc: 'price_desc',
    relevance: 'relevance',
  };

  return sort ? sortMap[sort] ?? 'relevance' : 'relevance';
}
```

Replace the `searchStorefrontProducts` signature with an `args` parameter and update the RPC argument object:

```ts
export async function searchStorefrontProducts(
  args: SearchStorefrontProductsArgs
): Promise<StorefrontSearchResult> {
  if (!isValidUuid(args.merchantId)) {
    throw new InvalidMerchantIdError();
  }

  const sanitizedQuery = sanitizeSearchQuery(args.query);
  const safeLimit = clampSearchLimit(args.limit);
  const safeOffset = normalizeSearchOffset(args.offset);
  const filters = args.filters ?? {};

  const { data: rankedResultsRaw, error } = await args.supabase.rpc(
    'search_products_v2',
    {
      brand_filter: filters.brand ?? null,
      category_id_filter: filters.categoryId ?? null,
      condition_filter: filters.condition ?? null,
      max_price_filter: filters.maxPrice ?? null,
      merchant_id_param: args.merchantId,
      min_price_filter: filters.minPrice ?? null,
      min_rating_filter: filters.minRating ?? null,
      parent_only: false,
      result_limit: safeLimit,
      result_offset: safeOffset,
      search_query: sanitizedQuery,
      sort_by: args.sort ?? 'relevance',
      status_filter: 'active',
      stock_filter: filters.stock ?? null,
    }
  );
```

Keep the rest of the function behavior the same, but call `scheduleSearchAnalyticsInsert` only when `args.trackAnalytics !== false`:

```ts
if (args.trackAnalytics !== false) {
  scheduleSearchAnalyticsInsert({
    supabase: args.analyticsSupabase,
    merchantId: args.merchantId,
    query: sanitizedQuery,
    resultsCount: count,
  });
}
```

Add the existing storefront filter helper import:

```ts
import { storefrontProductFilters } from './storefront-product-filters';
```

Expand `getStorefrontSearchProducts` so later search-page work can pass the same safe options through. Keep `searchStorefrontProducts` as the low-level exact RPC wrapper, but make `getStorefrontSearchProducts` treat condition filters as storefront family filters after hydration. Current SQL exact-matches `p.condition = condition_filter`, while storefront rows can expose `available_conditions` and `has_condition_offers`; this helper must therefore request ranked candidates with `condition_filter: null`, then use `storefrontProductFilters.matchesStorefrontConditionFilter` before slicing:

```ts
export async function getStorefrontSearchProducts(args: {
  merchantId: string;
  query: string;
  limit: number;
  offset?: number;
  filters?: StorefrontSearchFilters;
  sort?: StorefrontSearchSort;
}): Promise<StorefrontSearchProductsPage> {
  const publicSupabase = createPublicClient({
    clientInfo: 'baci-storefront-search-page',
  });
  const serverSupabase = createClient(await cookies());
  const requestedLimit = clampSearchLimit(args.limit);
  const requestedOffset = normalizeSearchOffset(args.offset);
  const needsConditionFamilyFilter =
    Boolean(args.filters?.condition) &&
    !storefrontProductFilters.isAllFilter(args.filters?.condition);
  const searchFilters = needsConditionFamilyFilter
    ? { ...args.filters, condition: null }
    : args.filters;

  const searchResult = await searchStorefrontProducts({
    supabase: serverSupabase,
    merchantId: args.merchantId,
    query: args.query,
    limit: needsConditionFamilyFilter ? 100 : requestedLimit,
    offset: needsConditionFamilyFilter ? 0 : requestedOffset,
    filters: searchFilters,
    sort: args.sort,
  });

  if (searchResult.productIds.length === 0) {
    return {
      ...searchResult,
      products: [],
    };
  }

  const { data, error } = await publicSupabase
    .from('products')
    .select(STOREFRONT_PRODUCTS_COMPACT_SELECT)
    .in('id', searchResult.productIds)
    .eq('merchant_id', args.merchantId)
    .eq('status', 'active');

  if (error) {
    throw error;
  }

  const mapped = (data ?? []).map((row) => normalizeProduct(row as never));
  const order = new Map(
    searchResult.productIds.map((id, index) => [id, index] as const)
  );

  mapped.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const filteredProducts = needsConditionFamilyFilter
    ? mapped.filter((product) =>
        storefrontProductFilters.matchesStorefrontConditionFilter(
          product,
          args.filters?.condition ?? ''
        )
      )
    : mapped;
  const visibleProducts = needsConditionFamilyFilter
    ? filteredProducts.slice(requestedOffset, requestedOffset + requestedLimit)
    : filteredProducts;
  const visibleProductIds = needsConditionFamilyFilter
    ? visibleProducts.map((product) => product.id)
    : searchResult.productIds;

  return {
    ...searchResult,
    count: needsConditionFamilyFilter ? filteredProducts.length : searchResult.count,
    productIds: visibleProductIds,
    products: visibleProducts,
  };
}
```

The condition-family branch intentionally uses a bounded 100-candidate ranked window so the search page does not drop open-box offer-family products due to the exact SQL condition predicate. If the product team needs exact full-count pagination for condition facets later, enhance `search_products_v2` to filter against `available_conditions`/`has_condition_offers` in SQL instead of widening this client-side window.

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @baci/web exec vitest run src/lib/storefront-search.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/storefront-search.ts apps/web/src/lib/storefront-search.test.ts
git commit -m "feat(search): expand shared storefront search options"
```

---

## Task 3: Make Autocomplete Use Ranked Search

**Files:**
- Create: `apps/web/src/lib/storefront-search-autocomplete.ts`
- Create: `apps/web/src/lib/storefront-search-autocomplete.test.ts`
- Modify: `apps/web/src/app/api/search/autocomplete/route.ts`
- Modify: `apps/web/src/app/api/search/search-security.test.ts`
- Modify: `apps/web/src/components/storefront/search-autocomplete.test.tsx`

- [ ] **Step 1: Write the failing adapter test**

Create `apps/web/src/lib/storefront-search-autocomplete.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStorefrontAutocompleteProducts } from './storefront-search-autocomplete';

const searchStorefrontProducts = vi.fn();
const productQuery = {
  select: vi.fn(() => productQuery),
  in: vi.fn(() => productQuery),
  eq: vi.fn(() => productQuery),
  then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise.resolve({
    data: [
      { id: 'p2', name: 'iPhone 16 Pro', category: 'Smartphones', price: 1200000, images: ['two.jpg'], slug: 'iphone-16-pro' },
      { id: 'p1', name: 'iPhone X', category: 'Smartphones', price: 240000, images: ['one.jpg'], slug: 'iphone-x' },
    ],
    error: null,
  }).then(resolve),
};

const supabase = {
  rpc: vi.fn(),
  from: vi.fn(() => productQuery),
};
const VALID_MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';

vi.mock('./storefront-search', () => ({
  searchStorefrontProducts: (...args: unknown[]) => searchStorefrontProducts(...args),
}));

describe('getStorefrontAutocompleteProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates ranked ids into autocomplete suggestions in ranked order', async () => {
    searchStorefrontProducts.mockResolvedValueOnce({
      count: 2,
      didYouMean: null,
      productIds: ['p1', 'p2'],
      query: 'iphnoe',
    });

    const result = await getStorefrontAutocompleteProducts({
      supabase: supabase as never,
      merchantId: VALID_MERCHANT_ID,
      query: 'iphnoe',
      limit: 10,
    });

    expect(result.suggestions.map((product) => product.id)).toEqual(['p1', 'p2']);
    expect(searchStorefrontProducts).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'iphnoe', limit: 10, trackAnalytics: false })
    );
  });

  it('returns empty suggestions for short queries without hitting the rpc', async () => {
    const result = await getStorefrontAutocompleteProducts({
      supabase: supabase as never,
      merchantId: VALID_MERCHANT_ID,
      query: 'i',
      limit: 10,
    });

    expect(result).toEqual({ suggestions: [], popularSearches: [] });
    expect(searchStorefrontProducts).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the adapter test and verify it fails**

```bash
pnpm --filter @baci/web exec vitest run src/lib/storefront-search-autocomplete.test.ts
```

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the adapter**

Create `apps/web/src/lib/storefront-search-autocomplete.ts`:

```ts
import { searchStorefrontProducts } from './storefront-search';

const AUTOCOMPLETE_PRODUCT_SELECT = 'id, name, category, price, images, slug';

interface AutocompleteProductRow {
  id: string;
  name: string;
  category: string | null;
  price: number | string | null;
  images: unknown;
  slug: string | null;
}

interface AutocompleteProductQuery extends PromiseLike<{ data: AutocompleteProductRow[] | null; error: unknown }> {
  select: (columns: string) => AutocompleteProductQuery;
  in: (column: string, values: string[]) => AutocompleteProductQuery;
  eq: (column: string, value: string) => AutocompleteProductQuery;
}

interface AutocompleteSupabase {
  from: (table: string) => AutocompleteProductQuery;
}

export interface AutocompleteProductSuggestion {
  id: string;
  name: string;
  category: string | null;
  price: number | string | null;
  image_small: string | null;
  slug: string | null;
  relevance: number;
}

export interface AutocompleteResponse {
  suggestions: AutocompleteProductSuggestion[];
  popularSearches: Array<{ search_query: string; search_count: number }>;
}

function getImageSmall(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const [firstImage] = images;
  return typeof firstImage === 'string' ? firstImage : null;
}

export async function getStorefrontAutocompleteProducts({
  supabase,
  merchantId,
  query,
  limit,
}: {
  supabase: Parameters<typeof searchStorefrontProducts>[0]['supabase'] & AutocompleteSupabase;
  merchantId: string;
  query: string;
  limit: number;
}): Promise<AutocompleteResponse> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return { suggestions: [], popularSearches: [] };
  }

  const ranked = await searchStorefrontProducts({
    supabase,
    merchantId,
    query: trimmedQuery,
    limit,
    trackAnalytics: false,
  });

  if (ranked.productIds.length === 0) {
    return { suggestions: [], popularSearches: [] };
  }

  const { data, error } = await supabase
    .from('products')
    .select(AUTOCOMPLETE_PRODUCT_SELECT)
    .in('id', ranked.productIds)
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (error) throw error;

  const order = new Map(ranked.productIds.map((id, index) => [id, index] as const));
  const suggestions = (data ?? [])
    .map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      image_small: getImageSmall(product.images),
      slug: product.slug,
      relevance: 1,
    }))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return { suggestions, popularSearches: [] };
}
```

- [ ] **Step 4: Refactor the route to use the adapter**

Modify `apps/web/src/app/api/search/autocomplete/route.ts`:

```ts
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sanitizeSearchQuery } from '@/lib/sanitize-core';
import { getStorefrontAutocompleteProducts } from '@/lib/storefront-search-autocomplete';
import { createClient } from '@/lib/supabase/server';
```

Remove `sanitizeLikePattern`, `AUTOCOMPLETE_PRODUCT_SELECT`, `AUTOCOMPLETE_SEARCH_COLUMNS`, `fetchProductAutocompleteRows`, and route-local `getImageSmall`. Inside `GET`, replace the body of the successful branch with:

```ts
const cookieStore = await cookies();
const supabase = createClient(cookieStore);
const result = await getStorefrontAutocompleteProducts({
  supabase,
  merchantId,
  query,
  limit,
});

return NextResponse.json(result);
```

Also update the existing short-query return to preserve the stable response shape:

```ts
if (query.length < 2) {
  return NextResponse.json({ suggestions: [], popularSearches: [] });
}
```

- [ ] **Step 5: Update route security coverage for ranked autocomplete**

Modify `apps/web/src/app/api/search/search-security.test.ts` in the `GET /api/search/autocomplete` block so it no longer asserts the removed direct products-table `ilike` implementation.

Keep the security intent, but rewrite the implementation-specific expectations:

- Replace expectations that autocomplete directly calls `.ilike(...)` on `products` with expectations that sanitized user text reaches `search_products_v2` through `mockSupabase.rpc('search_products_v2', expect.objectContaining({ merchant_id_param: merchantId, search_query: expectedQuery }))`.
- For tests that expect product suggestions, mock the first `mockSupabase.rpc` call with ranked rows such as `{ data: [{ product_id: 'product-id', total_count: 1 }], error: null }` before asserting product-row hydration. Do not rely on `mockProductsQueryData` alone; the ranked adapter hydrates only after `search_products_v2` returns product IDs.
- Keep the assertion that `sharedChainableMock.or` is not called for comma, quote, percent, or wildcard-like input.
- Replace old `.limit(...)` assertions with hydration assertions against `.from('products')`, `.select('id, name, category, price, images, slug')`, `.in('id', rankedIds)`, `.eq('merchant_id', merchantId)`, and `.eq('status', 'active')`.
- Keep invalid `limit` and invalid `merchant_id` cases proving Supabase is not queried when validation fails.
- Add or retain a short-query case proving `q=i` returns `{ suggestions: [], popularSearches: [] }` and does not call `mockSupabase.rpc` or product hydration.
- Keep timeout behavior for Postgres code `57014`, unsupported image payload normalization to `null`, and the guarantee that `popularSearches` remains `[]`.

- [ ] **Step 6: Add component coverage for ranked suggestions and empty ranked results**

Append these tests to `apps/web/src/components/storefront/search-autocomplete.test.tsx` near the existing autocomplete suggestion tests:

```tsx
it('renders ranked autocomplete suggestions in API order', async () => {
  vi.useRealTimers();
  const fetchMock = vi.mocked(globalThis.fetch);
  fetchMock.mockResolvedValue({
    json: async () => ({
      suggestions: [
        {
          id: 'product-2',
          name: 'iPhone 16 Pro',
          slug: 'iphone-16-pro',
          category: 'Smartphones',
          price: 1200000,
          image_small: '',
        },
        {
          id: 'product-1',
          name: 'iPhone X',
          slug: 'iphone-x',
          category: 'Smartphones',
          price: 240000,
          image_small: '',
        },
      ],
      popularSearches: [],
    }),
  } as Response);

  render(
    <SearchAutocomplete
      merchantId="merchant-1"
      value="iphnoe"
      onChange={vi.fn()}
    />
  );

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/search/autocomplete?q=iphnoe&merchant_id=merchant-1&limit=10'
    );
  });

  const options = await screen.findAllByRole('option');
  expect(options.map((option) => option.textContent)).toEqual([
    expect.stringContaining('iPhone 16 Pro'),
    expect.stringContaining('iPhone X'),
  ]);
});

it('keeps the autocomplete popup closed for empty ranked suggestions', async () => {
  vi.useRealTimers();
  const fetchMock = vi.mocked(globalThis.fetch);
  fetchMock.mockResolvedValue({
    json: async () => ({
      suggestions: [],
      popularSearches: [],
    }),
  } as Response);

  render(
    <SearchAutocomplete
      merchantId="merchant-1"
      value="zzzz"
      onChange={vi.fn()}
    />
  );

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/search/autocomplete?q=zzzz&merchant_id=merchant-1&limit=10'
    );
  });

  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
```

- [ ] **Step 7: Run route and component tests**

```bash
pnpm --filter @baci/web exec vitest run src/lib/storefront-search-autocomplete.test.ts
pnpm --filter @baci/web exec vitest run src/app/api/search/search-security.test.ts
pnpm --filter @baci/web exec vitest run src/components/storefront/search-autocomplete.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/storefront-search-autocomplete.ts apps/web/src/lib/storefront-search-autocomplete.test.ts apps/web/src/app/api/search/autocomplete/route.ts apps/web/src/app/api/search/search-security.test.ts apps/web/src/components/storefront/search-autocomplete.test.tsx
git commit -m "feat(search): rank autocomplete with storefront search"
```

---

## Task 4: Route `q` Product APIs Through Ranked Search

**Files:**
- Modify: `apps/web/src/app/api/storefront/products/route.ts`
- Modify: `apps/web/src/app/api/storefront/products/route.test-helpers.ts`
- Modify: `apps/web/src/app/api/storefront/products/route.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/components/comparison-product-search.test.ts`

- [ ] **Step 1: Add failing route tests**

First extend `apps/web/src/app/api/storefront/products/route.test-helpers.ts` so the existing server-client mock can serve both `rpc` and `from('products')` calls:

```ts
const mockSearchRpc = {
  current: vi.fn(),
};

const mockCreateServerClient = vi.fn(() => ({
  rpc: (...args: unknown[]) => mockSearchRpc.current(...args),
  from: vi.fn((table: string) => {
    if (table === 'products') {
      return createProductsByIdsQuery();
    }

    throw new Error(`Unexpected table: ${table}`);
  }),
}));
```

Add `mockSearchRpc` to the exported `storefrontProductsRouteTestHarness`, and in `reset()` set `mockSearchRpc.current = vi.fn()`.

Then in `apps/web/src/app/api/storefront/products/route.test.ts`, add:

```ts
it('uses ranked storefront search when q is present', async () => {
  storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce({
    data: [
      { product_id: 'product-2', total_count: 2 },
      { product_id: 'product-1', total_count: 2 },
    ],
    error: null,
  });

  storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
    data: [
      storefrontProductsRouteTestHarness.createRawProduct({ id: 'product-1', name: 'iPhone X' }),
      storefrontProductsRouteTestHarness.createRawProduct({ id: 'product-2', name: 'iPhone 16 Pro' }),
    ],
    error: null,
  };

  const response = await GET(
    new NextRequest(
      `https://example.com/api/storefront/products?merchant_id=${VALID_MERCHANT_ID}&q=iphnoe&limit=20`
    )
  );

  const body = await response.json();
  expect(storefrontProductsRouteTestHarness.mockSearchRpc.current).toHaveBeenCalledWith(
    'search_products_v2',
    expect.objectContaining({ search_query: 'iphnoe', sort_by: 'relevance' })
  );
  expect(storefrontProductsRouteTestHarness.mockProductsByIdsQuery.current?.in).toHaveBeenCalledWith(
    'id',
    ['product-2', 'product-1']
  );
  expect(body.products.map((product: { id: string }) => product.id)).toEqual(['product-2', 'product-1']);
});

it('preserves category filtering when q is present', async () => {
  storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce({
    data: [
      { product_id: 'product-3', total_count: 3 },
      { product_id: 'product-2', total_count: 2 },
      { product_id: 'product-1', total_count: 2 },
    ],
    error: null,
  });

  storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
    data: [
      storefrontProductsRouteTestHarness.createRawProduct({
        id: 'product-1',
        name: 'iPhone Case',
        category: 'Accessories',
        categories: { id: 'cat-1', name: 'Accessories', slug: 'accessories' },
      }),
      storefrontProductsRouteTestHarness.createRawProduct({
        id: 'product-2',
        name: 'iPhone 16 Pro',
        category: 'Phones',
        categories: { id: 'cat-2', name: 'Phones', slug: 'phones' },
      }),
      storefrontProductsRouteTestHarness.createRawProduct({
        id: 'product-3',
        name: 'iPhone Stand',
        category: 'Accessories',
        categories: { id: 'cat-1', name: 'Accessories', slug: 'accessories' },
      }),
    ],
    error: null,
  };

  const response = await GET(
    new NextRequest(
      `https://example.com/api/storefront/products?merchant_id=${VALID_MERCHANT_ID}&q=iphone&category=phones&limit=20`
    )
  );

  const body = await response.json();
  expect(body.products.map((product: { id: string }) => product.id)).toEqual(['product-2']);
  expect(storefrontProductsRouteTestHarness.mockSearchRpc.current).toHaveBeenCalledWith(
    'search_products_v2',
    expect.objectContaining({ result_limit: 100 })
  );
});

it('preserves slug-form brand filtering when q is present', async () => {
  storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce({
    data: [
      { product_id: 'product-1', total_count: 2 },
      { product_id: 'product-2', total_count: 2 },
    ],
    error: null,
  });

  storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
    data: [
      storefrontProductsRouteTestHarness.createRawProduct({
        id: 'product-1',
        name: 'Sony Ericsson Xperia',
        brand: 'Sony Ericsson',
      }),
      storefrontProductsRouteTestHarness.createRawProduct({
        id: 'product-2',
        name: 'LG C3',
        brand: 'LG',
        slug: 'lg-c3',
      }),
    ],
    error: null,
  };

  const response = await GET(
    new NextRequest(
      `https://example.com/api/storefront/products?merchant_id=${VALID_MERCHANT_ID}&q=phone&brand=sony-ericsson&limit=1`
    )
  );

  const body = await response.json();
  expect(storefrontProductsRouteTestHarness.mockSearchRpc.current).toHaveBeenCalledWith(
    'search_products_v2',
    expect.objectContaining({ brand_filter: null, result_limit: 100 })
  );
  expect(body.products.map((product: { id: string }) => product.id)).toEqual(['product-1']);
});

it('keeps ranked count when q is present with all filters', async () => {
  storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce({
    data: [{ product_id: 'product-1', total_count: 7 }],
    error: null,
  });

  storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
    data: [
      storefrontProductsRouteTestHarness.createRawProduct({
        id: 'product-1',
        name: 'iPhone 16 Pro',
        brand: 'Apple',
      }),
    ],
    error: null,
  };

  const response = await GET(
    new NextRequest(
      `https://example.com/api/storefront/products?merchant_id=${VALID_MERCHANT_ID}&q=iphone&brand=All&category=All&condition=all&limit=1`
    )
  );

  const body = await response.json();
  expect(storefrontProductsRouteTestHarness.mockSearchRpc.current).toHaveBeenCalledWith(
    'search_products_v2',
    expect.objectContaining({ result_limit: 1 })
  );
  expect(body.count).toBe(7);
});

it('preserves secondary category memberships when q is present', async () => {
  storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce({
    data: [
      { product_id: 'product-1', total_count: 2 },
      { product_id: 'product-2', total_count: 2 },
    ],
    error: null,
  });

  storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
    data: [
      storefrontProductsRouteTestHarness.createRawProduct({
        id: 'product-1',
        name: 'Gaming Monitor',
        category: 'Gaming',
        categories: { id: 'cat-3', name: 'Gaming', slug: 'gaming' },
        product_categories: [
          {
            categories: {
              id: 'cat-1',
              name: 'Smart TVs',
              slug: 'smart-tvs',
            },
          },
        ],
      }),
      storefrontProductsRouteTestHarness.createRawProduct({
        id: 'product-2',
        name: 'Console',
        category: 'Gaming',
        categories: { id: 'cat-3', name: 'Gaming', slug: 'gaming' },
      }),
    ],
    error: null,
  };

  const response = await GET(
    new NextRequest(
      `https://example.com/api/storefront/products?merchant_id=${VALID_MERCHANT_ID}&q=gaming&category=smart-tvs&limit=20`
    )
  );

  const body = await response.json();
  expect(body.products.map((product: { id: string }) => product.id)).toEqual(['product-1']);
});

it('preserves condition-offer filtering when q is present', async () => {
  storefrontProductsRouteTestHarness.mockSearchRpc.current.mockResolvedValueOnce({
    data: [
      { product_id: 'product-1', total_count: 2 },
      { product_id: 'product-2', total_count: 2 },
    ],
    error: null,
  });

  storefrontProductsRouteTestHarness.mockProductsByIdsResult.current = {
    data: [
      storefrontProductsRouteTestHarness.createRawProduct({
        id: 'product-1',
        name: 'iPhone 13',
        condition: 'new',
        has_condition_offers: true,
      }),
      storefrontProductsRouteTestHarness.createRawProduct({
        id: 'product-2',
        name: 'iPhone 12',
        condition: 'new',
        has_condition_offers: false,
      }),
    ],
    error: null,
  };

  const response = await GET(
    new NextRequest(
      `https://example.com/api/storefront/products?merchant_id=${VALID_MERCHANT_ID}&q=iphone&condition=used&limit=20`
    )
  );

  const body = await response.json();
  expect(storefrontProductsRouteTestHarness.mockSearchRpc.current).toHaveBeenCalledWith(
    'search_products_v2',
    expect.objectContaining({ condition_filter: null, result_limit: 100 })
  );
  expect(body.products.map((product: { id: string }) => product.id)).toEqual(['product-1']);
});
```

Also add characterization coverage to `apps/web/src/components/storefront/ogabassey/components/comparison-product-search.test.ts` so the comparison search helper continues to send typo queries through the same merchant/category-scoped API path:

```ts
it('forwards typo comparison searches to the same merchant-scoped storefront API', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => ({
        ok: true,
        status: 200,
        json: async () => ({
            products: [{ id: 'candidate-product', name: 'iPhone 16 Pro', price: 1200000 }],
        }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const signal = new AbortController().signal;
    const results = await fetchComparisonProductSearchResults({
        query: 'iphnoe',
        mainProduct: {
            id: 'main-product',
            merchantId: 'merchant-1',
            category: 'Smartphones',
            categorySlug: 'smartphones',
        },
        comparisonProducts: [],
        signal,
    });

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();

    const [requestUrl, requestInit] = firstCall;
    const url = new URL(String(requestUrl), 'http://localhost');

    expect(url.pathname).toBe('/api/storefront/products');
    expect(url.searchParams.get('q')).toBe('iphnoe');
    expect(url.searchParams.get('merchant_id')).toBe('merchant-1');
    expect(url.searchParams.get('category')).toBe('smartphones');
    expect(url.searchParams.get('compact')).toBe('false');
    expect(requestInit).toEqual({ signal });
    expect(results).toEqual([
        { id: 'candidate-product', name: 'iPhone 16 Pro', price: 1200000 },
    ]);
});
```

- [ ] **Step 2: Run the targeted test and verify it fails**

```bash
pnpm --filter @baci/web exec vitest run src/app/api/storefront/products/route.test.ts -t "ranked storefront search|preserves .* q is present|condition-offer"
```

Expected: FAIL because the route still uses `ilike` and has not added raw-row q-path filtering.

- [ ] **Step 3: Implement q-ranked path**

In `apps/web/src/app/api/storefront/products/route.ts`, import:

```ts
import {
  searchStorefrontProducts,
  toStorefrontSearchSort,
} from '@/lib/storefront-search';
```

Before `createCachedProductsFetcher` is called, add:

```ts
if (q) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const requestedLimit = limit ?? 20;
  const searchSort = searchParams.has('sort')
    ? toStorefrontSearchSort(sort)
    : 'relevance';
  const usesInMemoryFilters =
    Boolean(category && !storefrontProductFilters.isAllFilter(category)) ||
    Boolean(brand && !storefrontProductFilters.isAllFilter(brand)) ||
    Boolean(condition && !storefrontProductFilters.isAllFilter(condition));
  const rankedLimit = usesInMemoryFilters ? 100 : requestedLimit;
  const ranked = await searchStorefrontProducts({
    supabase,
    merchantId,
    query: q,
    limit: rankedLimit,
    filters: {
      brand: null,
      condition: null,
      maxPrice: max_price ?? null,
      minPrice: min_price ?? null,
    },
    sort: searchSort,
  });

  if (ranked.productIds.length === 0) {
    return NextResponse.json(
      { products: [], didYouMean: ranked.didYouMean, count: ranked.count },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  }

  const productRows = await fetchProductRowsByIds(merchantId, ranked.productIds, { compact });
  const order = new Map(ranked.productIds.map((id, index) => [id, index] as const));
  const filteredRows = productRows
    .filter((product) =>
      !category ||
      storefrontProductFilters.isAllFilter(category) ||
      storefrontProductFilters.matchesStorefrontCategoryFilter(
        storefrontProductsRouteData.buildCategoryFilterSource(product),
        category
      )
    )
    .filter((product) =>
      !brand ||
      storefrontProductFilters.isAllFilter(brand) ||
      storefrontProductFilters.matchesStorefrontBrandFilter(product, brand)
    )
    .filter((product) =>
      !condition ||
      storefrontProductFilters.isAllFilter(condition) ||
      storefrontProductFilters.matchesStorefrontConditionFilter(product, condition)
    );

  filteredRows.sort((a, b) => (order.get(String(a.id)) ?? 0) - (order.get(String(b.id)) ?? 0));
  const visibleProducts = filteredRows
    .slice(0, requestedLimit)
    .map(storefrontProductsRouteData.mapProduct);
  const responseCount = usesInMemoryFilters ? filteredRows.length : ranked.count;

  return NextResponse.json(
    { products: visibleProducts, didYouMean: ranked.didYouMean, count: responseCount },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
  );
}
```

Add a small raw-row helper above `fetchProductsByIds`, then have the existing `fetchProductsByIds` map its result through `storefrontProductsRouteData.mapProduct` so the non-search `ids` path keeps the same response shape:

```ts
async function fetchProductRowsByIds(
  merchantId: string,
  ids: string[],
  options: { compact?: boolean } = {}
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const selectColumns: string =
    options.compact === false
      ? storefrontProductsRouteData.STOREFRONT_PRODUCTS_SELECT
      : storefrontProductsRouteData.STOREFRONT_PRODUCTS_COMPACT_SELECT;

  const { data: products, error } = (await supabase
    .from('products')
    .select(selectColumns)
    .eq('merchant_id', merchantId)
    .in('id', ids)) as {
    data: RawStorefrontProductRow[] | null;
    error: unknown;
  };

  if (error) throw error;

  return products || [];
}

async function fetchProductsByIds(
  merchantId: string,
  ids: string[],
  options: { compact?: boolean } = {}
) {
  const products = await fetchProductRowsByIds(merchantId, ids, options);

  return products.map(storefrontProductsRouteData.mapProduct);
}
```

Do not remove the existing non-`q` cached path. Do not pass route-level `brand` or `condition` into `search_products_v2` for this API path: current behavior accepts slug-form brand filters such as `sony-ericsson`, secondary category memberships through `product_categories`, and condition-offer families through `has_condition_offers`. Use ranked search to get candidates, then apply the existing `storefrontProductFilters` semantics to raw rows and slice after filtering. Derive `responseCount` from `usesInMemoryFilters`, not raw truthy params, so `brand=All`, `category=All`, and `condition=all` keep the RPC `ranked.count`. Also keep q-search default sort as relevance; `storefrontProductsQuerySchema` defaults `sort` to `newest` for browse/listing calls, which must not override search relevance unless the request explicitly includes `sort`.

- [ ] **Step 4: Run route and comparison tests**

```bash
pnpm --filter @baci/web exec vitest run src/app/api/storefront/products/route.test.ts
pnpm --filter @baci/web exec vitest run src/components/storefront/ogabassey/components/comparison-product-search.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/storefront/products/route.ts apps/web/src/app/api/storefront/products/route.test-helpers.ts apps/web/src/app/api/storefront/products/route.test.ts apps/web/src/components/storefront/ogabassey/components/comparison-product-search.test.ts
git commit -m "feat(search): use ranked search for storefront product queries"
```

---

## Task 5: Add Accent-Insensitive Product Search Normalization

**Files:**
- Create: `supabase/migrations/20260617120000_product_search_locale_normalization.sql`
- Create: `supabase/migrations/tests/product_search_locale_normalization.sql`

- [ ] **Step 1: Write the SQL regression test**

Create `supabase/migrations/tests/product_search_locale_normalization.sql`:

```sql
BEGIN;

DO $$
DECLARE
  v_normalized_plain text;
  v_normalized_accent text;
  v_unaccent_schema text;
  v_has_blank_search_path boolean;
BEGIN
  SELECT n.nspname
    INTO v_unaccent_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'unaccent';

  IF v_unaccent_schema IS DISTINCT FROM 'extensions' THEN
    RAISE EXCEPTION 'unaccent extension must live in extensions schema, found %',
      COALESCE(v_unaccent_schema, '<missing>');
  END IF;

  SELECT public.normalize_product_search_text('ṣamṣung') INTO v_normalized_accent;
  SELECT public.normalize_product_search_text('samsung') INTO v_normalized_plain;

  IF v_normalized_accent <> v_normalized_plain THEN
    RAISE EXCEPTION 'accented and unaccented search terms should normalize equally: % <> %',
      v_normalized_accent,
      v_normalized_plain;
  END IF;

  SELECT COALESCE(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=']
    INTO v_has_blank_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'normalize_product_search_text'
    AND pg_get_function_identity_arguments(p.oid) = 'search_text text';

  IF NOT v_has_blank_search_path THEN
    RAISE EXCEPTION 'normalize_product_search_text must pin a blank search_path';
  END IF;
END $$;

ROLLBACK;
```

- [ ] **Step 2: Run the SQL test against local Supabase and verify it fails before migration**

```bash
supabase db reset
LOCAL_DB_URL="$(supabase status -o env | awk -F= '/^DB_URL=/{print $2}')"
test -n "$LOCAL_DB_URL"
psql "$LOCAL_DB_URL" -f supabase/migrations/tests/product_search_locale_normalization.sql
```

Expected: FAIL because `ṣamṣung` does not normalize to `samsung`, or because the function search path is not blank.

- [ ] **Step 3: Add the migration**

Create `supabase/migrations/20260617120000_product_search_locale_normalization.sql`:

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
ALTER EXTENSION unaccent SET SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.immutable_unaccent(search_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT extensions.unaccent('extensions.unaccent', COALESCE(search_text, ''));
$$;

CREATE OR REPLACE FUNCTION public.normalize_product_search_text(search_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT pg_catalog.trim(
    pg_catalog.regexp_replace(
      pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            pg_catalog.regexp_replace(
              pg_catalog.regexp_replace(
                pg_catalog.lower(
                  pg_catalog.regexp_replace(
                    pg_catalog.regexp_replace(
                      public.immutable_unaccent(search_text),
                      '([a-z])([0-9])',
                      '\1 \2',
                      'g'
                    ),
                    '([0-9])([a-z])',
                    '\1 \2',
                    'g'
                  )
                ),
                '\mpro[\s-]*max\M',
                'pro max',
                'g'
              ),
              '\mwi[\s-]*fi\M',
              'wifi',
              'g'
            ),
            '\me[\s-]*sim\M',
            'esim',
            'g'
          ),
          '\mdual[\s-]*sim\M',
          'dual sim',
          'g'
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.compact_product_search_text(search_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT pg_catalog.regexp_replace(public.normalize_product_search_text(search_text), '\s+', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.product_search_vector_v2(
  product_name text,
  product_brand text,
  product_category text,
  product_sku text,
  product_description text
)
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT
    setweight(to_tsvector('simple', public.normalize_product_search_text(coalesce(product_name, ''))), 'A')
    || setweight(to_tsvector('simple', public.normalize_product_search_text(coalesce(product_sku, ''))), 'A')
    || setweight(to_tsvector('simple', public.normalize_product_search_text(coalesce(product_brand, ''))), 'B')
    || setweight(to_tsvector('simple', public.normalize_product_search_text(coalesce(product_category, ''))), 'B')
    || setweight(to_tsvector('simple', public.normalize_product_search_text(coalesce(product_description, ''))), 'C');
$$;

DROP INDEX IF EXISTS public.products_search_name_compact_trgm;
DROP INDEX IF EXISTS public.products_search_name_normalized_trgm;
DROP INDEX IF EXISTS public.products_search_vector_v2_gin;

CREATE INDEX IF NOT EXISTS products_search_name_compact_trgm
  ON public.products
  USING gin (public.compact_product_search_text(name) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_search_name_normalized_trgm
  ON public.products
  USING gin (public.normalize_product_search_text(name) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_search_vector_v2_gin
  ON public.products
  USING gin (public.product_search_vector_v2(name, brand, category, sku, description));

COMMENT ON FUNCTION public.immutable_unaccent(text)
  IS 'Immutable unaccent wrapper for product-search expression indexes.';
```

Operational stop rule: do not apply this migration directly to production outside the approved prebuilt deployment/migration flow. It drops and recreates product-search expression indexes because the indexed normalization function changes; apply it only with an accepted maintenance/deploy window and post-apply `EXPLAIN` checks for `search_products_v2`.

Legacy generated-column note: the baseline also has `products.search_vector` and `products_search_vector_gin`, which are English-only and not used by `search_products_v2`. Do not drop them in P0. Before any follow-up removal, scan app and SQL callers and confirm product search no longer reads the generated column; blog `search_vector` usage is unrelated and must not be changed.

- [ ] **Step 4: Apply migration locally and run SQL tests**

```bash
supabase db reset
LOCAL_DB_URL="$(supabase status -o env | awk -F= '/^DB_URL=/{print $2}')"
test -n "$LOCAL_DB_URL"
psql "$LOCAL_DB_URL" -f supabase/migrations/tests/product_search_locale_normalization.sql
```

Expected: PASS.

- [ ] **Step 5: Run targeted search tests**

```bash
pnpm --filter @baci/web exec vitest run src/lib/storefront-search.test.ts src/lib/storefront-search-autocomplete.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260617120000_product_search_locale_normalization.sql supabase/migrations/tests/product_search_locale_normalization.sql
git commit -m "feat(search): add accent-insensitive product normalization"
```

---

## Task 6: Route Agentic, Chat, And MCP Search Through Ranked Search

**Files:**
- Modify: `apps/web/src/app/api/agentic/catalog/search/route.ts`
- Modify: `apps/web/src/app/api/agentic/catalog/search/route.test.ts`
- Modify: `apps/web/src/ai/chat-tool-handlers.ts`
- Modify: `apps/web/src/ai/chat-tool-handlers.test.ts`
- Create: `apps/web/mcp-server/search-products-ranking.ts`
- Create: `apps/web/mcp-server/search-products-ranking.test.ts`
- Modify: `apps/web/mcp-server/server.ts`

- [ ] **Step 1: Add failing UCP parity test**

In `apps/web/src/app/api/agentic/catalog/search/route.test.ts`, first change the mocked merchant id from `merchant-1` to a valid UUID because `searchStorefrontProducts` rejects non-UUID merchant ids:

```ts
const VALID_AGENTIC_MERCHANT_ID = '00000000-0000-4000-8000-000000000001';
```

Use `id: VALID_AGENTIC_MERCHANT_ID` in `mockResolveAgenticMerchantContext`, and update existing route expectations from `'merchant-1'` to `VALID_AGENTIC_MERCHANT_ID`.

Then extend the local test harness instead of introducing external helpers. Add `in` and `rpc` support next to the existing `mockProductRows` helper:

```ts
let mockRpc: ReturnType<typeof vi.fn>;

function mockRankedProductRows(rows: ProductRow[], rankedIds: string[]) {
  mockRpc = vi.fn().mockResolvedValue({
    data: rankedIds.map((id) => ({ product_id: id, total_count: rankedIds.length })),
    error: null,
  });
  query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: rows, error: null })),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
  };
  mockSelect = vi.fn(() => query);
  vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue({
    rpc: mockRpc,
    from: vi.fn(() => ({ select: mockSelect })),
  } as never);

  return { rpc: mockRpc };
}
```

Update the local `query` type to include `in: ReturnType<typeof vi.fn>`. Also update the existing `mockProductRows` helper to include both `in: vi.fn(() => query)` and a default `mockRpc` that ranks the provided rows in their current order:

```ts
function mockProductRows(rows: ProductRow[]) {
  mockRpc = vi.fn().mockResolvedValue({
    data: rows
      .filter((row) => row.status !== 'draft')
      .map((row) => ({ product_id: row.id, total_count: rows.length })),
    error: null,
  });
  query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: rows, error: null })),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
  };
  mockSelect = vi.fn(() => query);
  vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue({
    rpc: mockRpc,
    from: vi.fn(() => ({ select: mockSelect })),
  } as never);
}
```

Update the existing `returns matching active products for a text query` test so it no longer expects the removed `query.or(...)` call. It should expect:

```ts
expect(query.eq).toHaveBeenCalledWith('merchant_id', VALID_AGENTIC_MERCHANT_ID);
expect(query.eq).toHaveBeenCalledWith('status', 'active');
expect(mockRpc).toHaveBeenCalledWith('search_products_v2', expect.objectContaining({ search_query: 'iphone' }));
expect(query.in).toHaveBeenCalledWith('id', ['product-1']);
expect(query.or).not.toHaveBeenCalled();
```

Then add:

```ts
it('uses search_products_v2 for catalog search ranking', async () => {
  const { rpc } = mockRankedProductRows(
    [
      { id: 'product-1', name: 'iPhone X', price: 240000, slug: 'iphone-x', status: 'active' },
      { id: 'product-2', name: 'iPhone 16 Pro', price: 1200000, slug: 'iphone-16-pro', status: 'active' },
    ],
    ['product-2', 'product-1']
  );

  const { POST } = await import('./route');
  const response = await POST(
    new NextRequest('http://localhost/api/agentic/catalog/search', {
      body: JSON.stringify({ query: 'iphnoe', pagination: { limit: 20 } }),
      method: 'POST',
    })
  );
  const body = await response.json();

  expect(rpc).toHaveBeenCalledWith('search_products_v2', expect.objectContaining({ search_query: 'iphnoe' }));
  expect(query.in).toHaveBeenCalledWith('id', ['product-2', 'product-1']);
  expect(body.products.map((product: { id: string }) => product.id)).toEqual(['product-2', 'product-1']);
});
```

- [ ] **Step 2: Run the UCP test and verify it fails**

```bash
pnpm --filter @baci/web exec vitest run src/app/api/agentic/catalog/search/route.test.ts -t "search_products_v2"
```

Expected: FAIL because the route uses `ilike`.

- [ ] **Step 3: Implement UCP ranked search**

In `apps/web/src/app/api/agentic/catalog/search/route.ts`, import:

```ts
import { searchStorefrontProducts } from '@/lib/storefront-search';
```

Replace the `let query = context.supabase.from('products')...` block with:

```ts
const limit = parsed.data.pagination?.limit ?? 20;
const ranked = parsed.data.query
  ? await searchStorefrontProducts({
      supabase: context.supabase,
      merchantId: context.merchant.id,
      query: parsed.data.query,
      limit,
      trackAnalytics: false,
    })
  : null;

let query = context.supabase
  .from('products')
  .select(PRODUCT_SELECT)
  .eq('merchant_id', context.merchant.id)
  .eq('status', 'active');

if (ranked) {
  if (ranked.productIds.length === 0) {
    return NextResponse.json(
      buildUcpCatalogProductsResponse({
        capability: UCP_CATALOG_SEARCH_CAPABILITY,
        products: [],
      })
    );
  }
  query = query.in('id', ranked.productIds);
}

const { data, error } = await query
  .order('created_at', { ascending: false })
  .limit(limit);
```

Remove the route-local `escapeLikePattern` helper in the same edit; after this replacement the agentic route no longer uses `ilike` pattern escaping, and leaving it behind will fail unused-symbol linting.

After mapping rows, preserve ranked order:

```ts
const order = new Map((ranked?.productIds ?? []).map((id, index) => [id, index] as const));
const products = filterActiveUcpCatalogProductRows((data ?? []) as UcpCatalogProductRow[])
  .map((row) => mapUcpCatalogProductRow({ baseUrl, currency: CATALOG_CURRENCY, row }))
  .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
```

- [ ] **Step 4: Add chat tool handler ranked-search coverage**

In `apps/web/src/ai/chat-tool-handlers.test.ts`, extend the hoisted mocks before importing `handleSearchProducts`:

```ts
const mocks = vi.hoisted(() => ({
  createAgenticScopedSupabaseClient: vi.fn(),
  searchStorefrontProducts: vi.fn(),
}));
```

Add the shared search mock beside the existing scoped Supabase mock:

```ts
vi.mock('@/lib/storefront-search', () => ({
  searchStorefrontProducts: mocks.searchStorefrontProducts,
}));
```

In `beforeEach`, reset the shared-search mock:

```ts
mocks.searchStorefrontProducts.mockReset();
```

Then update the existing product-search tests so they no longer assert the legacy `query.or(...)` filter. Keep the PostgREST separator and wildcard cases, but rewrite them to prove the chat handler does not construct direct `.or(...ilike...)` filters for user text.

Add this failing test:

```ts
it('routes chat product search through shared ranked search and preserves ranked hydration order', async () => {
  mocks.searchStorefrontProducts.mockResolvedValue({
    count: 2,
    didYouMean: null,
    productIds: ['iphone-16-pro', 'iphone-x'],
    query: 'iphnoe',
  });
  const query = createQueryMock({
    count: 2,
    data: [
      {
        id: 'iphone-x',
        name: 'iPhone X',
        price: 240000,
        description: 'Used iPhone',
        brand: 'Apple',
        category: 'Phones',
        images: [{ url: 'https://cdn.example.com/iphone-x.jpg' }],
        stock: 2,
        status: 'active',
      },
      {
        id: 'iphone-16-pro',
        name: 'iPhone 16 Pro',
        price: 1200000,
        description: 'New iPhone',
        brand: 'Apple',
        category: 'Phones',
        images: [{ url: 'https://cdn.example.com/iphone-16-pro.jpg' }],
        stock: 5,
        status: 'active',
      },
    ],
    error: null,
  });
  mocks.createAgenticScopedSupabaseClient.mockReturnValue({
    from: vi.fn(() => query),
    rpc: vi.fn(),
  });

  const result = await handleSearchProducts({
    query: 'iphnoe',
    minPrice: 100000,
    maxPrice: 1500000,
  });

  expect(mocks.searchStorefrontProducts).toHaveBeenCalledWith(
    expect.objectContaining({
      filters: expect.objectContaining({
        maxPrice: 1500000,
        minPrice: 100000,
      }),
      limit: 10,
      merchantId: OGABASSEY_MERCHANT_ID,
      query: 'iphnoe',
      trackAnalytics: false,
    })
  );
  expect(query.in).toHaveBeenCalledWith('id', ['iphone-16-pro', 'iphone-x']);
  expect(query.or).not.toHaveBeenCalled();
  expect(result.products.map((product) => product.id)).toEqual([
    'iphone-16-pro',
    'iphone-x',
  ]);
  expect(result.total).toBe(2);
});
```

Also add a category-only regression test so the chat tool does not lose its current behavior when `query` is blank:

```ts
it('uses category text as the ranked search query when no free-text query is provided', async () => {
  mocks.searchStorefrontProducts.mockResolvedValue({
    count: 0,
    didYouMean: null,
    productIds: [],
    query: 'Laptops',
  });
  const query = createQueryMock({ data: [], error: null });
  mocks.createAgenticScopedSupabaseClient.mockReturnValue({
    from: vi.fn(() => query),
    rpc: vi.fn(),
  });

  const result = await handleSearchProducts({
    query: '',
    category: 'Laptops',
  });

  expect(mocks.searchStorefrontProducts).toHaveBeenCalledWith(
    expect.objectContaining({
      merchantId: OGABASSEY_MERCHANT_ID,
      query: 'Laptops',
      trackAnalytics: false,
    })
  );
  expect(query.or).not.toHaveBeenCalled();
  expect(result).toEqual({ products: [], total: 0 });
});
```

Add the ranked-search error path so chat product search keeps the current fail-closed behavior:

```ts
it('returns empty chat search results when ranked search fails', async () => {
  mocks.searchStorefrontProducts.mockRejectedValueOnce(
    new Error('search rpc unavailable')
  );
  mocks.createAgenticScopedSupabaseClient.mockReturnValue({
    from: vi.fn(),
    rpc: vi.fn(),
  });

  const result = await handleSearchProducts({
    query: 'iphone',
  });

  expect(result).toEqual({ products: [], total: 0 });
});
```

- [ ] **Step 5: Run the chat handler test and verify it fails**

```bash
pnpm --filter @baci/web exec vitest run src/ai/chat-tool-handlers.test.ts -t "ranked search|category text|ranked search fails"
```

Expected: FAIL because `handleSearchProducts` still builds a direct PostgREST `.or(...ilike...)` filter and never calls `searchStorefrontProducts`.

- [ ] **Step 6: Implement chat ranked search**

In `apps/web/src/ai/chat-tool-handlers.ts`, change the scoped client type and import the shared search contract. Remove the `sanitizeLikePattern` import in the same edit; the handler should keep `sanitizeSearchQuery` but no longer build direct `ilike` filters.

```ts
import { searchStorefrontProducts } from '@/lib/storefront-search';

type ChatToolSupabaseClient = Pick<SupabaseClient, 'from' | 'rpc'>;
```

Delete `escapeProductSearchTerm` and `createProductSearchFilter`. Replace them with helpers that build the chat search text and preserve ranked order after hydration:

```ts
function buildChatSearchText(params: SearchProductsParams): string {
  return [params.query, params.category]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => sanitizeSearchQuery(value).trim())
    .filter(Boolean)
    .join(' ');
}

function orderProductsByRankedIds<T extends { id: string }>(
  products: T[],
  rankedIds: string[]
): T[] {
  const order = new Map(rankedIds.map((id, index) => [id, index] as const));
  return [...products].sort(
    (a, b) =>
      (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  );
}
```

Then update `handleSearchProducts` so text/category searches go through `search_products_v2` via `searchStorefrontProducts`, while price-only browsing keeps the current active-product query path:

```ts
const supabase = createChatToolSupabaseClient();
const searchText = buildChatSearchText(params);
let ranked: Awaited<ReturnType<typeof searchStorefrontProducts>> | null = null;

if (searchText) {
  try {
    ranked = await searchStorefrontProducts({
      supabase,
      filters: {
        maxPrice: params.maxPrice ?? null,
        minPrice: params.minPrice ?? null,
      },
      limit: 10,
      merchantId: OGABASSEY_MERCHANT_ID,
      query: searchText,
      trackAnalytics: false,
    });
  } catch (error) {
    console.error('[Chat Tools] Search ranking error:', error);
    return { products: [], total: 0 };
  }
}

let query = supabase
  .from('products')
  .select('id, name, price, description, brand, category, images, stock, status')
  .eq('merchant_id', OGABASSEY_MERCHANT_ID)
  .eq('status', 'active')
  .order('price', { ascending: false })
  .limit(10);

if (ranked) {
  if (ranked.productIds.length === 0) {
    return { products: [], total: ranked.count };
  }
  query = query.in('id', ranked.productIds);
}

if (params.maxPrice) {
  query = query.lte('price', params.maxPrice);
}
if (params.minPrice) {
  query = query.gte('price', params.minPrice);
}
```

After mapping rows, preserve ranked order and use the ranked total when the shared search path was used:

```ts
const mappedProducts = (data || []).map((p) => ({
  id: p.id,
  name: p.name,
  price: p.price,
  description: p.description,
  brand: p.brand,
  category: p.category,
  image_url:
    Array.isArray(p.images) && p.images[0]?.url ? p.images[0].url : null,
  stock: p.stock,
  status: p.status,
}));
const products = ranked
  ? orderProductsByRankedIds(mappedProducts, ranked.productIds)
  : mappedProducts;

return { products, total: ranked?.count ?? (count || products.length) };
```

- [ ] **Step 7: Add MCP ranked search helper coverage**

Do not add `mockSupabase` assertions to `apps/web/mcp-server/server.test.ts`; the current MCP tests start the server as a child process and do not expose a mocked Supabase client. Instead create `apps/web/mcp-server/search-products-ranking.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildSearchProductsV2RpcArgs,
  orderRowsByRankedProductIds,
} from './search-products-ranking';

describe('MCP search_products ranking helpers', () => {
  it('builds search_products_v2 arguments for ranked MCP catalog search', () => {
    expect(
      buildSearchProductsV2RpcArgs({
        args: {
          brand: 'Apple',
          condition: 'used',
          max_price: 500000,
          min_price: 100000,
          sort: 'price_asc',
        },
        limit: 20,
        merchantId: '123e4567-e89b-12d3-a456-426614174000',
        sanitizedQuery: 'iphnoe',
      })
    ).toEqual({
      brand_filter: null,
      category_id_filter: null,
      condition_filter: 'used',
      max_price_filter: 500000,
      merchant_id_param: '123e4567-e89b-12d3-a456-426614174000',
      min_price_filter: 100000,
      min_rating_filter: null,
      parent_only: false,
      result_limit: 100,
      result_offset: 0,
      search_query: 'iphnoe',
      sort_by: 'price_asc',
      status_filter: 'active',
      stock_filter: null,
    });
  });

  it('normalizes MCP condition aliases before building rpc arguments', () => {
    expect(
      buildSearchProductsV2RpcArgs({
        args: {
          condition: 'refurbished',
        },
        limit: 10,
        merchantId: '123e4567-e89b-12d3-a456-426614174000',
        sanitizedQuery: 'iphone',
      })
    ).toMatchObject({
      condition_filter: 'open_box',
    });
  });

  it('preserves ranked product order after product hydration', () => {
    expect(
      orderRowsByRankedProductIds(
        [
          { id: 'product-1', name: 'iPhone X' },
          { id: 'product-2', name: 'iPhone 16 Pro' },
        ],
        ['product-2', 'product-1']
      ).map((row) => row.id)
    ).toEqual(['product-2', 'product-1']);
  });
});
```

- [ ] **Step 8: Update MCP implementation**

Create `apps/web/mcp-server/search-products-ranking.ts`:

```ts
import { normalizeCanonicalProductCondition } from '@baci/shared/lib';

interface McpSearchProductsArgs {
  brand?: string;
  category?: string;
  condition?: 'new' | 'used' | 'open_box' | 'refurbished' | string;
  max_price?: number;
  min_price?: number;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'relevance';
}

export function buildSearchProductsV2RpcArgs({
  args,
  limit,
  merchantId,
  sanitizedQuery,
}: {
  args: McpSearchProductsArgs;
  limit: number;
  merchantId: string;
  sanitizedQuery: string;
}) {
  const conditionFilter =
    normalizeCanonicalProductCondition(args.condition) || null;

  return {
    brand_filter: null,
    category_id_filter: null,
    condition_filter: conditionFilter,
    max_price_filter: args.max_price ?? null,
    merchant_id_param: merchantId,
    min_price_filter: args.min_price ?? null,
    min_rating_filter: null,
    parent_only: false,
    result_limit: args.brand || args.category ? 100 : limit,
    result_offset: 0,
    search_query: sanitizedQuery,
    sort_by: args.sort ?? 'relevance',
    status_filter: 'active',
    stock_filter: null,
  };
}

export function orderRowsByRankedProductIds<T extends { id: string }>(
  rows: T[],
  rankedProductIds: string[]
) {
  const order = new Map(
    rankedProductIds.map((id, index) => [id, index] as const)
  );

  return [...rows].sort(
    (a, b) =>
      (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  );
}
```

In `apps/web/mcp-server/server.ts`, import:

```ts
import {
  buildSearchProductsV2RpcArgs,
  orderRowsByRankedProductIds,
} from './search-products-ranking';
```

Then replace only the product lookup part of `search_products`. Preserve its public tool schema. The database flow for a query must be:

```ts
const ranked = sanitizedQuery
  ? await supabase.rpc(
      'search_products_v2',
      buildSearchProductsV2RpcArgs({
        args: {
          brand: args.brand ? sanitizeString(args.brand, 50) : undefined,
          category: args.category ? sanitizeString(args.category, 50) : undefined,
          condition: args.condition ? sanitizeString(args.condition, 50) : undefined,
          max_price: args.max_price,
          min_price: args.min_price,
          sort: args.sort,
        },
        limit,
        merchantId,
        sanitizedQuery,
      })
    )
  : null;
```

Immediately after the RPC call, fail on RPC errors and extract ranked ids before hydrating product rows:

```ts
if (ranked?.error) throw ranked.error;

const rankedProductIds = Array.isArray(ranked?.data)
  ? ranked.data
      .map((row) =>
        row && typeof row === 'object' && 'product_id' in row
          ? String(row.product_id)
          : null
      )
      .filter((id): id is string => Boolean(id))
  : [];

if (sanitizedQuery && rankedProductIds.length === 0) {
  return {
    content: [
      {
        type: 'text',
        text: `No specific products found for "${sanitizedQuery}". Try broader terms.`,
      },
    ],
    structuredContent: { products: [], status: 'empty' },
  };
}
```

Then fetch product rows by `rankedProductIds` when `sanitizedQuery` exists. Keep the same tenant and publication guards on that hydration query as the existing MCP search path: `.eq('merchant_id', merchantId)`, `.eq('status', 'active')`, and `.in('id', rankedProductIds)`. Apply the existing category and brand filters to hydrated rows with the same case-insensitive/partial behavior the tool already has, sort the remaining rows with `orderRowsByRankedProductIds(products, rankedProductIds)`, and slice to `limit` before returning tool content. Leave the existing non-query filtered path in place for browse/filter-only calls. Do not pass MCP `brand` into the RPC `brand_filter`; the RPC uses exact database comparison, while the public MCP tool currently accepts broader brand strings.

- [ ] **Step 9: Run tests**

```bash
pnpm --filter @baci/web exec vitest run src/app/api/agentic/catalog/search/route.test.ts
pnpm --filter @baci/web exec vitest run src/ai/chat-tool-handlers.test.ts
pnpm --filter @baci/web exec vitest run src/app/api/chat/chat-tool-runtime.test.ts src/app/api/chat/ollama-chat-tool-runtime.test.ts
pnpm --filter @baci/web exec vitest run mcp-server/search-products-ranking.test.ts
pnpm --filter @baci/web exec vitest run mcp-server/server.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/api/agentic/catalog/search/route.ts apps/web/src/app/api/agentic/catalog/search/route.test.ts apps/web/src/ai/chat-tool-handlers.ts apps/web/src/ai/chat-tool-handlers.test.ts apps/web/mcp-server/search-products-ranking.ts apps/web/mcp-server/search-products-ranking.test.ts apps/web/mcp-server/server.ts
git commit -m "feat(search): align agentic catalog search ranking"
```

---

## Task 7: P0 Search No-Results Recovery And Did-You-Mean Link

**Files:**
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/search/search-page-content.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/search/search-page-content.test.tsx`

- [ ] **Step 1: Add failing tests**

In `search-page-content.test.tsx`, add these helpers near the existing imports and mocks if they do not already exist:

```ts
const mockGetStorefrontSearchProducts = vi.mocked(getStorefrontSearchProducts);

function createSearchPageProps(searchParams: {
  brand?: string;
  condition?: string;
  max_price?: string;
  min_price?: string;
  page?: string;
  q?: string;
  sort?: string;
} = {}) {
  return {
    params: Promise.resolve({ slug: 'ogabassey' }),
    searchParams: Promise.resolve({
      page: '1',
      ...searchParams,
    }),
  };
}

function createSearchProducts(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `product-${index + 1}`,
    name: index === 0 ? 'iPhone 16' : `iPhone ${index + 17}`,
    price: 1200000 + index * 1000,
    slug: index === 0 ? 'iphone-16' : `iphone-${index + 17}`,
    category: 'Phones',
    category_slug: 'phones',
  }));
}
```

Then add tests that assert:

```ts
it('renders did-you-mean as a search link', async () => {
  mockGetStorefrontSearchProducts.mockResolvedValueOnce({
    count: 0,
    didYouMean: 'iphone',
    products: [],
    productIds: [],
    query: 'iphnoe',
  });

  render(await SearchPageContent(createSearchPageProps({ q: 'iphnoe' })));

  expect(screen.getByRole('link', { name: /iphone/i })).toHaveAttribute(
    'href',
    '/ogabassey/search?q=iphone'
  );
});

it('shows recovery actions when a search has no results', async () => {
  mockGetStorefrontSearchProducts.mockResolvedValueOnce({
    count: 0,
    didYouMean: null,
    products: [],
    productIds: [],
    query: 'nonexistent quantum gadget',
  });

  render(await SearchPageContent(createSearchPageProps({ q: 'nonexistent quantum gadget' })));

  expect(screen.getByRole('heading', { name: /no products found/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /view all products/i })).toHaveAttribute(
    'href',
    '/ogabassey/products'
  );
  expect(screen.getByRole('link', { name: /contact support/i })).toHaveAttribute(
    'href',
    '/ogabassey/contact'
  );
});
```

Use the helper functions above for the new tests.

- [ ] **Step 2: Run tests and verify they fail**

```bash
pnpm --filter @baci/web exec vitest run src/app/\(storefront\)/\[slug\]/\(catalog\)/\(listing\)/search/search-page-content.test.tsx -t "did-you-mean|recovery"
```

Expected: FAIL because did-you-mean is text only and no recovery links exist.

- [ ] **Step 3: Implement links**

In `search-page-content.tsx`, derive:

```ts
const allProductsHref = `${pathPrefix}/products` || '/products';
const contactHref = `${pathPrefix}/contact` || '/contact';
const didYouMeanHref = searchResult.didYouMean
  ? `${pathPrefix}/search?q=${encodeURIComponent(searchResult.didYouMean)}`
  : null;
```

Replace the did-you-mean text with:

```tsx
{searchResult.didYouMean && didYouMeanHref && (
  <p className="mt-4 text-sm text-store-background-text/55">
    Did you mean{' '}
    <Link href={asRoute(didYouMeanHref)} className="font-medium text-store-primary underline-offset-4 hover:underline">
      {searchResult.didYouMean}
    </Link>
    ?
  </p>
)}
```

Inside the zero-results card, add:

```tsx
<div className="mt-6 flex flex-wrap items-center justify-center gap-3">
  <Link
    href={asRoute(allProductsHref)}
    prefetch={false}
    className="rounded-md bg-store-primary px-4 py-2 text-sm font-semibold text-store-primary-text transition hover:opacity-90"
  >
    View all products
  </Link>
  <Link
    href={asRoute(contactHref)}
    prefetch={false}
    className="rounded-md border border-store-background-text/15 px-4 py-2 text-sm font-semibold text-store-background-text transition hover:border-store-primary hover:text-store-primary"
  >
    Contact support
  </Link>
</div>
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @baci/web exec vitest run src/app/\(storefront\)/\[slug\]/\(catalog\)/\(listing\)/search/search-page-content.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run P0 target tests**

```bash
pnpm --filter @baci/web exec vitest run src/lib/storefront-search.test.ts src/lib/storefront-search-autocomplete.test.ts src/app/api/storefront/products/route.test.ts src/app/api/agentic/catalog/search/route.test.ts src/app/\(storefront\)/\[slug\]/\(catalog\)/\(listing\)/search/search-page-content.test.tsx
pnpm --filter baci-mobile-admin exec vitest run lib/product-search.test.ts
pnpm --filter @baci/mobile-storefront exec jest --runInBand hooks/product-utils.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(storefront\)/\[slug\]/\(catalog\)/\(listing\)/search/search-page-content.tsx apps/web/src/app/\(storefront\)/\[slug\]/\(catalog\)/\(listing\)/search/search-page-content.test.tsx
git commit -m "feat(search): improve no-results recovery"
```

- [ ] **Step 7: P0 gate**

```bash
pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test
coderabbit review --prompt-only -t uncommitted
```

Expected: all pass. Fix critical/high CodeRabbit findings before opening P0 PR.

---

## Task 8: Deterministic Query Intent Parser

**Files:**
- Create: `apps/web/src/lib/search-query-intent.ts`
- Create: `apps/web/src/lib/search-query-intent.test.ts`
- Modify: `apps/web/src/lib/storefront-search.ts`
- Modify: `apps/web/src/lib/storefront-search.test.ts`

- [ ] **Step 1: Write parser tests**

Create `apps/web/src/lib/search-query-intent.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseSearchQueryIntent } from './search-query-intent';

describe('parseSearchQueryIntent', () => {
  it('parses Nigerian shorthand max price', () => {
    expect(parseSearchQueryIntent('phone under 500k')).toEqual({
      cleanedQuery: 'phone',
      filters: { maxPrice: 500000 },
    });
  });

  it('parses million shorthand max price', () => {
    expect(parseSearchQueryIntent('laptop below 2m')).toEqual({
      cleanedQuery: 'laptop',
      filters: { maxPrice: 2000000 },
    });
  });

  it('parses storage while keeping product intent', () => {
    expect(parseSearchQueryIntent('256gb iphone')).toEqual({
      cleanedQuery: '256gb iphone',
      filters: { storageGb: 256 },
    });
  });

  it('parses used condition terms', () => {
    expect(parseSearchQueryIntent('used iphone')).toEqual({
      cleanedQuery: 'iphone',
      filters: { condition: 'used' },
    });
  });

  it('parses open box and refurbished condition terms', () => {
    expect(parseSearchQueryIntent('open box iphone')).toEqual({
      cleanedQuery: 'iphone',
      filters: { condition: 'open_box' },
    });
    expect(parseSearchQueryIntent('refurbished laptop')).toEqual({
      cleanedQuery: 'laptop',
      filters: { condition: 'open_box' },
    });
  });

  it('keeps dual sim and esim in the cleaned query', () => {
    expect(parseSearchQueryIntent('dual sim iphone')).toEqual({
      cleanedQuery: 'dual sim iphone',
      filters: {},
    });
    expect(parseSearchQueryIntent('esim iphone')).toEqual({
      cleanedQuery: 'esim iphone',
      filters: {},
    });
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
pnpm --filter @baci/web exec vitest run src/lib/search-query-intent.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement parser**

Create `apps/web/src/lib/search-query-intent.ts`:

```ts
import type { CanonicalProductCondition } from '@baci/shared/lib';

export interface ParsedSearchQueryIntent {
  cleanedQuery: string;
  filters: {
    condition?: CanonicalProductCondition;
    maxPrice?: number;
    minPrice?: number;
    storageGb?: number;
  };
}

function parseNairaAmount(value: string, suffix: string | undefined) {
  const amount = Number.parseFloat(value.replaceAll(',', ''));
  if (!Number.isFinite(amount)) return null;
  if (suffix?.toLowerCase() === 'k') return Math.round(amount * 1_000);
  if (suffix?.toLowerCase() === 'm') return Math.round(amount * 1_000_000);
  return Math.round(amount);
}

function compactSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function parseSearchQueryIntent(query: string): ParsedSearchQueryIntent {
  const filters: ParsedSearchQueryIntent['filters'] = {};
  let cleanedQuery = query.toLowerCase();

  cleanedQuery = cleanedQuery.replace(
    /\b(?:under|below|less than|up to)\s*(?:ngn|n|\u20a6)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)([km])?\b/gi,
    (_match, amount: string, suffix: string | undefined) => {
      const parsedAmount = parseNairaAmount(amount, suffix);
      if (parsedAmount != null) filters.maxPrice = parsedAmount;
      return ' ';
    }
  );

  cleanedQuery = cleanedQuery.replace(
    /\b(?:over|above|from|at least)\s*(?:ngn|n|\u20a6)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)([km])?\b/gi,
    (_match, amount: string, suffix: string | undefined) => {
      const parsedAmount = parseNairaAmount(amount, suffix);
      if (parsedAmount != null) filters.minPrice = parsedAmount;
      return ' ';
    }
  );

  const storageMatch = cleanedQuery.match(/\b([0-9]{2,4})\s*(?:gb|g)\b/i);
  if (storageMatch?.[1]) {
    filters.storageGb = Number.parseInt(storageMatch[1], 10);
  }

  cleanedQuery = cleanedQuery.replace(/\b(?:pre[-\s]?owned|fairly\s+used|used)\b/gi, () => {
    filters.condition = 'used';
    return ' ';
  });

  cleanedQuery = cleanedQuery.replace(/\b(?:open[-\s]?box|refurbished)\b/gi, () => {
    filters.condition = 'open_box';
    return ' ';
  });

  cleanedQuery = cleanedQuery.replace(/\bbrand\s+new\b/gi, () => {
    filters.condition = 'new';
    return ' ';
  });

  return {
    cleanedQuery: compactSpaces(cleanedQuery),
    filters,
  };
}
```

- [ ] **Step 4: Wire parser into shared search**

In `apps/web/src/lib/storefront-search.ts`, import:

```ts
import { parseSearchQueryIntent } from './search-query-intent';
```

Before the RPC call, derive:

```ts
const parsedIntent = parseSearchQueryIntent(sanitizedQuery);
const effectiveQuery = parsedIntent.cleanedQuery || sanitizedQuery;
const filters = {
  ...(args.filters ?? {}),
  maxPrice: args.filters?.maxPrice ?? parsedIntent.filters.maxPrice ?? null,
  minPrice: args.filters?.minPrice ?? parsedIntent.filters.minPrice ?? null,
  condition: args.filters?.condition ?? parsedIntent.filters.condition ?? null,
};
```

Pass `effectiveQuery` as `search_query` and return `query: sanitizedQuery` so UI still displays the original query. Do not remove or RPC-wire `storageGb` yet; until a real storage/spec search column exists, keeping `256gb` in `effectiveQuery` preserves relevance better than silently dropping it.

- [ ] **Step 5: Add shared-search test**

In `apps/web/src/lib/storefront-search.test.ts`, add:

```ts
it('maps price intent into rpc filters while preserving the visible query', async () => {
  mockSupabase.rpc.mockResolvedValueOnce({
    data: [{ product_id: 'prod-1', total_count: 1 }],
    error: null,
  });

  const result = await searchStorefrontProducts({
    supabase: mockSupabase as never,
    merchantId: '123e4567-e89b-12d3-a456-426614174000',
    query: 'phone under 500k',
    limit: 20,
  });

  expect(result.query).toBe('phone under 500k');
  expect(mockSupabase.rpc).toHaveBeenCalledWith(
    'search_products_v2',
    expect.objectContaining({
      search_query: 'phone',
      max_price_filter: 500000,
    })
  );
});
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @baci/web exec vitest run src/lib/search-query-intent.test.ts src/lib/storefront-search.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/search-query-intent.ts apps/web/src/lib/search-query-intent.test.ts apps/web/src/lib/storefront-search.ts apps/web/src/lib/storefront-search.test.ts
git commit -m "feat(search): parse storefront query intent"
```

---

## Task 9: Search Page Facets, Sort, And Pagination

**Files:**
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/search/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/search/page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/search/search-page-content.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/search/search-page-content.test.tsx`

- [ ] **Step 1: Add failing tests for query params**

In `search-page-content.test.tsx`, first expand the existing `vi.mock('@/lib/storefront-search', ...)` block so it also provides `toStorefrontSearchSort`:

```ts
vi.mock('@/lib/storefront-search', () => ({
  searchStorefrontProducts: vi.fn(),
  getStorefrontSearchProducts: vi.fn(),
  toStorefrontSearchSort: (sort?: string | null) => {
    const sortMap: Record<string, string> = {
      newest: 'newest',
      popular: 'popular',
      'price-asc': 'price_asc',
      'price-desc': 'price_desc',
      price_asc: 'price_asc',
      price_desc: 'price_desc',
      relevance: 'relevance',
    };

    return sort ? sortMap[sort] ?? 'relevance' : 'relevance';
  },
}));
```

Then add:

```ts
it('passes filter and pagination params into storefront search', async () => {
  mockGetStorefrontSearchProducts.mockResolvedValueOnce({
    count: 50,
    didYouMean: null,
    products: [],
    productIds: [],
    query: 'iphone',
  });

  render(
    await SearchPageContent({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({
        q: 'iphone',
        condition: 'used',
        max_price: '500000',
        sort: 'price-asc',
        page: '2',
      }),
    })
  );

  expect(mockGetStorefrontSearchProducts).toHaveBeenCalledWith(
    expect.objectContaining({
      query: 'iphone',
      limit: 20,
      offset: 20,
      filters: expect.objectContaining({
        condition: 'used',
        maxPrice: 500000,
      }),
      sort: 'price_asc',
    })
  );
});

it('renders next page link when total count exceeds visible count', async () => {
  mockGetStorefrontSearchProducts.mockResolvedValueOnce({
    count: 40,
    didYouMean: null,
    products: createSearchProducts(20),
    productIds: [],
    query: 'iphone',
  });

  render(await SearchPageContent(createSearchPageProps({ q: 'iphone' })));

  expect(screen.getByRole('link', { name: /next/i })).toHaveAttribute(
    'href',
    '/ogabassey/search?q=iphone&page=2'
  );
});

it('renders all supported condition filter links', async () => {
  mockGetStorefrontSearchProducts.mockResolvedValueOnce({
    count: 0,
    didYouMean: null,
    products: [],
    productIds: [],
    query: 'iphone',
  });

  render(await SearchPageContent(createSearchPageProps({ q: 'iphone' })));

  expect(screen.getByRole('link', { name: 'New' })).toHaveAttribute(
    'href',
    '/ogabassey/search?q=iphone&condition=new'
  );
  expect(screen.getByRole('link', { name: 'Used' })).toHaveAttribute(
    'href',
    '/ogabassey/search?q=iphone&condition=used'
  );
  expect(screen.getByRole('link', { name: 'Open box' })).toHaveAttribute(
    'href',
    '/ogabassey/search?q=iphone&condition=open_box'
  );
});

it('does not pass raw brand URL params into the exact-match search RPC', async () => {
  mockGetStorefrontSearchProducts.mockResolvedValueOnce({
    count: 1,
    didYouMean: null,
    products: createSearchProducts(1),
    productIds: [],
    query: 'phone',
  });

  render(
    await SearchPageContent({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({
        q: 'phone',
        brand: 'sony-ericsson',
      }),
    })
  );

  expect(mockGetStorefrontSearchProducts).toHaveBeenCalledWith(
    expect.objectContaining({
      filters: expect.objectContaining({
        brand: null,
      }),
    })
  );
});

it('renders a server search form with the current query', async () => {
  mockGetStorefrontSearchProducts.mockResolvedValueOnce({
    count: 1,
    didYouMean: null,
    products: createSearchProducts(1),
    productIds: [],
    query: 'iphone',
  });

  render(await SearchPageContent(createSearchPageProps({ q: 'iphone' })));

  expect(
    screen.getByRole('search', { name: /product search/i })
  ).toHaveAttribute('action', '/ogabassey/search');
  expect(
    screen.getByRole('searchbox', { name: /search products/i })
  ).toHaveValue('iphone');
  expect(screen.getByRole('button', { name: /^search$/i })).toHaveAttribute(
    'type',
    'submit'
  );
});
```

In `page.test.tsx`, add a metadata characterization test. This test may pass before implementation, but it locks the SEO contract while `SearchPageProps.searchParams` expands:

```ts
it('keeps filtered and paginated search pages noindexed with canonical collapsed to query', async () => {
  vi.mocked(getRequestScopedMerchant).mockResolvedValue({
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'ogabassey',
    custom_domain: 'shop.example.ng',
    business_name: 'Ogabassey',
    payout_currency: 'NGN',
  } as never);

  mockHeaders.mockResolvedValue(
    new Headers([
      ['host', 'proxy.internal'],
      ['x-custom-domain', 'shop.example.ng'],
      ['x-pathname', '/search'],
    ])
  );

  const metadata = await generateMetadata({
    params: Promise.resolve({ slug: 'ogabassey' }),
    searchParams: Promise.resolve({
      q: 'iphone 16',
      brand: 'apple',
      condition: 'used',
      max_price: '500000',
      page: '2',
      sort: 'price-asc',
    }),
  });

  expect(metadata.robots).toMatchObject({
    index: false,
    follow: true,
  });
  expect(metadata.alternates).toMatchObject({
    canonical: 'https://shop.example.ng/search?q=iphone%2016',
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
pnpm --filter @baci/web exec vitest run src/app/\(storefront\)/\[slug\]/\(catalog\)/\(listing\)/search/search-page-content.test.tsx -t "filter and pagination|next page|brand URL|server search form"
pnpm --filter @baci/web exec vitest run src/app/\(storefront\)/\[slug\]/\(catalog\)/\(listing\)/search/page.test.tsx -t "filtered and paginated"
```

Expected: search-page-content tests FAIL because params are ignored; page metadata characterization test may already PASS and must keep passing.

- [ ] **Step 3: Expand `SearchPageProps`**

In both `page.tsx` and `search-page-content.tsx`, use:

```ts
export interface SearchPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    brand?: string;
    condition?: string;
    max_price?: string;
    min_price?: string;
    page?: string;
    q?: string;
    sort?: string;
  }>;
}
```

- [ ] **Step 4: Parse filters and call shared search**

In `search-page-content.tsx`, import `toStorefrontSearchSort` from `@/lib/storefront-search` alongside `getStorefrontSearchProducts`. Replace the current `const { q } = await searchParams;` line with:

```ts
const rawSearchParams = await searchParams;
const { q } = rawSearchParams;
```

Then derive:

```ts
const pageNumber = Math.max(Number.parseInt(rawSearchParams.page || '1', 10) || 1, 1);
const limit = 20;
const offset = (pageNumber - 1) * limit;
const maxPrice = rawSearchParams.max_price ? Number.parseInt(rawSearchParams.max_price, 10) : null;
const minPrice = rawSearchParams.min_price ? Number.parseInt(rawSearchParams.min_price, 10) : null;
const sort = toStorefrontSearchSort(rawSearchParams.sort);
```

Call:

Do not pass `rawSearchParams.brand` directly into the shared search filters in this task. The current `search_products_v2` SQL applies `p.brand = brand_filter` exactly, while current storefront product filtering accepts slug-form URL values such as `sony-ericsson`. Keep the brand param in the URL/canonical surface, but leave the RPC brand filter `null` until this page has an exact brand facet source or brand-id resolution step.

```ts
await getStorefrontSearchProducts({
  merchantId: merchant.id,
  query,
  limit,
  offset,
  filters: {
    brand: null,
    condition: rawSearchParams.condition || null,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
    minPrice: Number.isFinite(minPrice) ? minPrice : null,
  },
  sort,
});
```

- [ ] **Step 5: Add href builder and render controls**

In `search-page-content.tsx`, add this helper inside `SearchPageContent` after `didYouMeanHref` is derived:

```ts
function buildSearchHref(overrides: {
  brand?: string;
  condition?: string;
  max_price?: string;
  min_price?: string;
  page?: string;
  q?: string;
  sort?: string;
}) {
  const params = new URLSearchParams();
  const merged = {
    q: query || undefined,
    brand: rawSearchParams.brand || undefined,
    condition: rawSearchParams.condition || undefined,
    max_price: rawSearchParams.max_price || undefined,
    min_price: rawSearchParams.min_price || undefined,
    sort: rawSearchParams.sort || undefined,
    page: rawSearchParams.page || undefined,
    ...overrides,
  };

  for (const [key, value] of Object.entries(merged)) {
    if (value) {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  return `${pathPrefix}/search${queryString ? `?${queryString}` : ''}`;
}
```

Add server-rendered links for condition and sort:

```tsx
<form
  action={asRoute(`${pathPrefix}/search`)}
  aria-label="Product search"
  className="mt-6 flex w-full flex-col gap-3 sm:flex-row"
  role="search"
>
  <input
    aria-label="Search products"
    className="min-h-11 flex-1 rounded-md border border-store-background-text/15 bg-store-background px-3 text-sm text-store-background-text outline-none transition focus:border-store-primary"
    defaultValue={query}
    name="q"
    placeholder="Search products"
    type="search"
  />
  <button
    className="min-h-11 rounded-md bg-store-primary px-5 text-sm font-semibold text-store-primary-text transition hover:opacity-90"
    type="submit"
  >
    Search
  </button>
</form>

<div className="mt-6 flex flex-wrap gap-2" aria-label="Search filters">
  {[
    { label: 'New', value: 'new' },
    { label: 'Used', value: 'used' },
    { label: 'Open box', value: 'open_box' },
  ].map(({ label, value }) => (
    <Link
      key={value}
      href={asRoute(buildSearchHref({ condition: value, page: undefined }))}
      className="rounded-md border border-store-background-text/15 px-3 py-2 text-sm font-medium"
    >
      {label}
    </Link>
  ))}
  <Link href={asRoute(buildSearchHref({ sort: 'price-asc', page: undefined }))} className="rounded-md border border-store-background-text/15 px-3 py-2 text-sm font-medium">
    Price low to high
  </Link>
  <Link href={asRoute(buildSearchHref({ sort: 'price-desc', page: undefined }))} className="rounded-md border border-store-background-text/15 px-3 py-2 text-sm font-medium">
    Price high to low
  </Link>
</div>
```

- [ ] **Step 6: Render pagination**

Add:

```tsx
{searchResult.count > visibleCount && (
  <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Search pagination">
    {pageNumber > 1 && (
      <Link href={asRoute(buildSearchHref({ page: String(pageNumber - 1) }))} className="rounded-md border px-4 py-2 text-sm font-medium">
        Previous
      </Link>
    )}
    {pageNumber * limit < searchResult.count && (
      <Link href={asRoute(buildSearchHref({ page: String(pageNumber + 1) }))} className="rounded-md border px-4 py-2 text-sm font-medium">
        Next
      </Link>
    )}
  </nav>
)}
```

- [ ] **Step 7: Run tests**

```bash
pnpm --filter @baci/web exec vitest run src/app/\(storefront\)/\[slug\]/\(catalog\)/\(listing\)/search/search-page-content.test.tsx
pnpm --filter @baci/web exec vitest run src/app/\(storefront\)/\[slug\]/\(catalog\)/\(listing\)/search/page.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/\(storefront\)/\[slug\]/\(catalog\)/\(listing\)/search/page.tsx apps/web/src/app/\(storefront\)/\[slug\]/\(catalog\)/\(listing\)/search/page.test.tsx apps/web/src/app/\(storefront\)/\[slug\]/\(catalog\)/\(listing\)/search/search-page-content.tsx apps/web/src/app/\(storefront\)/\[slug\]/\(catalog\)/\(listing\)/search/search-page-content.test.tsx
git commit -m "feat(search): add storefront search filters and pagination"
```

---

## Task 10: Search Analytics Aggregates

**Files:**
- Create: `supabase/migrations/20260617122000_storefront_search_analytics_aggregates.sql`
- Create: `supabase/migrations/tests/storefront_search_analytics_aggregates.sql`

Do not modify `apps/web/src/lib/storefront-search.ts` in this task. The existing raw `search_analytics` insert remains the only search hot-path analytics write. Do not add an anon-callable rollup RPC; the autocomplete route already documents that the `popular_searches` view caused heavy sequential scans, and a public rollup writer would be both hot-path work and an anonymous spam vector.

- [ ] **Step 1: Add aggregate migration**

Create `supabase/migrations/20260617122000_storefront_search_analytics_aggregates.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.search_query_rollups (
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  normalized_query text NOT NULL,
  search_count bigint NOT NULL DEFAULT 0,
  zero_result_count bigint NOT NULL DEFAULT 0,
  click_count bigint NOT NULL DEFAULT 0,
  add_to_cart_count bigint NOT NULL DEFAULT 0,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_id, normalized_query)
);

ALTER TABLE public.search_query_rollups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can read own search query rollups"
  ON public.search_query_rollups;

CREATE POLICY "Merchants can read own search query rollups"
  ON public.search_query_rollups
  FOR SELECT
  USING (public.has_merchant_access(merchant_id));

CREATE OR REPLACE FUNCTION public.refresh_search_query_rollups(
  p_since timestamptz DEFAULT now() - interval '30 days'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows integer;
BEGIN
  DELETE FROM public.search_query_rollups
  WHERE last_seen_at >= p_since;

  INSERT INTO public.search_query_rollups (
    merchant_id,
    normalized_query,
    search_count,
    zero_result_count,
    first_seen_at,
    last_seen_at,
    refreshed_at
  )
  SELECT
    search_analytics.merchant_id,
    public.normalize_product_search_text(search_analytics.search_query) AS normalized_query,
    count(*)::bigint AS search_count,
    count(*) FILTER (WHERE COALESCE(search_analytics.results_count, 0) = 0)::bigint AS zero_result_count,
    min(search_analytics.created_at) AS first_seen_at,
    max(search_analytics.created_at) AS last_seen_at,
    now() AS refreshed_at
  FROM public.search_analytics
  WHERE search_analytics.created_at >= p_since
    AND search_analytics.merchant_id IS NOT NULL
    AND public.normalize_product_search_text(search_analytics.search_query) <> ''
  GROUP BY
    search_analytics.merchant_id,
    public.normalize_product_search_text(search_analytics.search_query)
  ON CONFLICT (merchant_id, normalized_query)
  DO UPDATE SET
    search_count = EXCLUDED.search_count,
    zero_result_count = EXCLUDED.zero_result_count,
    first_seen_at = EXCLUDED.first_seen_at,
    last_seen_at = EXCLUDED.last_seen_at,
    refreshed_at = now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_search_query_rollups(timestamptz)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_search_query_rollups(timestamptz)
  TO service_role;

CREATE INDEX IF NOT EXISTS idx_search_query_rollups_merchant_last_seen
  ON public.search_query_rollups (merchant_id, last_seen_at DESC);

REVOKE ALL ON TABLE public.search_query_rollups FROM PUBLIC;
GRANT SELECT ON TABLE public.search_query_rollups TO authenticated;
GRANT ALL ON TABLE public.search_query_rollups TO service_role;
```

- [ ] **Step 2: Add SQL test**

Create `supabase/migrations/tests/storefront_search_analytics_aggregates.sql`:

```sql
BEGIN;

DO $$
DECLARE
  v_rollup_rls boolean;
  v_granted_to_anon boolean;
  v_granted_to_authenticated boolean;
  v_public_execute boolean;
  v_anon_can_select boolean;
  v_authenticated_can_select boolean;
  v_has_blank_search_path boolean;
  v_rollup_uses_merchant_access boolean;
  v_test_merchant_id uuid := '00000000-0000-4000-8000-000000000010'::uuid;
  v_search_count bigint;
  v_zero_result_count bigint;
  v_blank_rollup_count bigint;
BEGIN
  SELECT relrowsecurity INTO v_rollup_rls
  FROM pg_class
  WHERE oid = 'public.search_query_rollups'::regclass;

  IF NOT v_rollup_rls THEN
    RAISE EXCEPTION 'search_query_rollups must have RLS enabled';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polrelid = 'public.search_query_rollups'::regclass
      AND polname = 'Merchants can read own search query rollups'
      AND pg_get_expr(polqual, polrelid) ~ 'has_merchant_access\(merchant_id\)'
  )
    INTO v_rollup_uses_merchant_access;

  IF NOT v_rollup_uses_merchant_access THEN
    RAISE EXCEPTION 'search_query_rollups SELECT policy must use has_merchant_access for owner and staff access';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(
      COALESCE(p.proacl, acldefault('f', p.proowner))
    ) acl
    WHERE p.oid = 'public.refresh_search_query_rollups(timestamptz)'::regprocedure
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  )
    INTO v_public_execute;

  SELECT has_function_privilege('anon', 'public.refresh_search_query_rollups(timestamptz)', 'EXECUTE')
    INTO v_granted_to_anon;

  SELECT has_function_privilege('authenticated', 'public.refresh_search_query_rollups(timestamptz)', 'EXECUTE')
    INTO v_granted_to_authenticated;

  IF v_public_execute OR v_granted_to_anon OR v_granted_to_authenticated THEN
    RAISE EXCEPTION 'refresh_search_query_rollups must only be executable by service_role';
  END IF;

  SELECT has_table_privilege('anon', 'public.search_query_rollups', 'SELECT')
    INTO v_anon_can_select;

  IF v_anon_can_select THEN
    RAISE EXCEPTION 'search_query_rollups must not be selectable by anon';
  END IF;

  SELECT has_table_privilege('authenticated', 'public.search_query_rollups', 'SELECT')
    INTO v_authenticated_can_select;

  IF NOT v_authenticated_can_select THEN
    RAISE EXCEPTION 'search_query_rollups must be selectable by authenticated merchants';
  END IF;

  SELECT COALESCE(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=']
    INTO v_has_blank_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'refresh_search_query_rollups'
    AND pg_get_function_identity_arguments(p.oid) = 'p_since timestamp with time zone';

  IF NOT v_has_blank_search_path THEN
    RAISE EXCEPTION 'refresh_search_query_rollups must pin a blank search_path';
  END IF;

  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_test_merchant_id,
    'search-rollup-test@example.com',
    'Search Rollup Test Merchant',
    'search-rollup-test-merchant'
  );

  INSERT INTO public.search_analytics (
    merchant_id,
    search_query,
    results_count,
    search_method,
    created_at
  )
  VALUES
    (v_test_merchant_id, ' iPhone ', 3, 'server', now()),
    (v_test_merchant_id, 'iphone', 0, 'server', now()),
    (v_test_merchant_id, '   ', 0, 'server', now());

  PERFORM public.refresh_search_query_rollups(now() - interval '1 day');

  SELECT search_count, zero_result_count
    INTO v_search_count, v_zero_result_count
  FROM public.search_query_rollups
  WHERE merchant_id = v_test_merchant_id
    AND normalized_query = 'iphone';

  IF v_search_count IS DISTINCT FROM 2 OR v_zero_result_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'search_query_rollups must normalize and aggregate query counts, got search_count %, zero_result_count %',
      v_search_count,
      v_zero_result_count;
  END IF;

  SELECT count(*)
    INTO v_blank_rollup_count
  FROM public.search_query_rollups
  WHERE merchant_id = v_test_merchant_id
    AND normalized_query = '';

  IF v_blank_rollup_count <> 0 THEN
    RAISE EXCEPTION 'refresh_search_query_rollups must ignore blank normalized queries';
  END IF;
END $$;

ROLLBACK;
```

- [ ] **Step 3: Apply migration and run SQL test**

```bash
supabase db reset
LOCAL_DB_URL="$(supabase status -o env | awk -F= '/^DB_URL=/{print $2}')"
test -n "$LOCAL_DB_URL"
psql "$LOCAL_DB_URL" -f supabase/migrations/tests/storefront_search_analytics_aggregates.sql
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260617122000_storefront_search_analytics_aggregates.sql supabase/migrations/tests/storefront_search_analytics_aggregates.sql
git commit -m "feat(search): add service-refreshed search analytics rollups"
```

---

## Task 11: Merchant Merchandising Rules

**Files:**
- Create: `supabase/migrations/20260617123000_storefront_search_merchandising.sql`
- Create: `supabase/migrations/tests/storefront_search_merchandising.sql`

- [ ] **Step 1: Add SQL migration**

Create `supabase/migrations/20260617123000_storefront_search_merchandising.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.search_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  phrase text NOT NULL,
  synonym text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, phrase, synonym)
);

CREATE TABLE IF NOT EXISTS public.search_product_merchandising_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  query_phrase text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('pin', 'boost', 'bury', 'hide')),
  boost_value numeric NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, query_phrase, product_id, action)
);

ALTER TABLE public.search_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_product_merchandising_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants manage own search synonyms"
  ON public.search_synonyms;

CREATE POLICY "Merchants manage own search synonyms"
  ON public.search_synonyms
  FOR ALL
  USING (public.has_merchant_access(merchant_id))
  WITH CHECK (public.has_merchant_access(merchant_id));

DROP POLICY IF EXISTS "Merchants manage own search merchandising rules"
  ON public.search_product_merchandising_rules;

CREATE POLICY "Merchants manage own search merchandising rules"
  ON public.search_product_merchandising_rules
  FOR ALL
  USING (public.has_merchant_access(merchant_id))
  WITH CHECK (public.has_merchant_access(merchant_id));

CREATE INDEX IF NOT EXISTS idx_search_synonyms_merchant_phrase
  ON public.search_synonyms (merchant_id, phrase)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_search_merchandising_merchant_query
  ON public.search_product_merchandising_rules (merchant_id, query_phrase)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS search_synonyms_updated_at
  ON public.search_synonyms;
CREATE TRIGGER search_synonyms_updated_at
  BEFORE UPDATE ON public.search_synonyms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS search_product_merchandising_rules_updated_at
  ON public.search_product_merchandising_rules;
CREATE TRIGGER search_product_merchandising_rules_updated_at
  BEFORE UPDATE ON public.search_product_merchandising_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_search_merchandising_product_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.products
    WHERE products.id = NEW.product_id
      AND products.merchant_id = NEW.merchant_id
  ) THEN
    RAISE EXCEPTION 'search merchandising product must belong to merchant'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS search_product_merchandising_rules_product_scope
  ON public.search_product_merchandising_rules;
CREATE TRIGGER search_product_merchandising_rules_product_scope
  BEFORE INSERT OR UPDATE OF merchant_id, product_id
  ON public.search_product_merchandising_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_search_merchandising_product_scope();

REVOKE ALL ON TABLE public.search_synonyms FROM PUBLIC;
REVOKE ALL ON TABLE public.search_product_merchandising_rules FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.search_synonyms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.search_product_merchandising_rules TO authenticated;
GRANT ALL ON TABLE public.search_synonyms TO service_role;
GRANT ALL ON TABLE public.search_product_merchandising_rules TO service_role;
```

- [ ] **Step 2: Add SQL test**

Create `supabase/migrations/tests/storefront_search_merchandising.sql`:

```sql
BEGIN;

DO $$
DECLARE
  v_synonym_rls boolean;
  v_rule_rls boolean;
  v_anon_can_insert_synonym boolean;
  v_authenticated_can_insert_synonym boolean;
  v_anon_can_insert_rule boolean;
  v_authenticated_can_insert_rule boolean;
  v_synonym_policy_uses_merchant_access boolean;
  v_rule_policy_uses_merchant_access boolean;
  v_synonym_updated_at_trigger boolean;
  v_rule_updated_at_trigger boolean;
  v_rule_product_scope_trigger boolean;
  v_rule_product_scope_blank_search_path boolean;
  v_scope_error_seen boolean := false;
  v_test_merchant_a uuid := '00000000-0000-4000-8000-000000000111'::uuid;
  v_test_merchant_b uuid := '00000000-0000-4000-8000-000000000222'::uuid;
  v_test_product_a uuid := '00000000-0000-4000-8000-000000000333'::uuid;
  v_test_product_b uuid := '00000000-0000-4000-8000-000000000444'::uuid;
BEGIN
  SELECT relrowsecurity INTO v_synonym_rls
  FROM pg_class
  WHERE oid = 'public.search_synonyms'::regclass;

  SELECT relrowsecurity INTO v_rule_rls
  FROM pg_class
  WHERE oid = 'public.search_product_merchandising_rules'::regclass;

  IF NOT v_synonym_rls THEN
    RAISE EXCEPTION 'search_synonyms must have RLS enabled';
  END IF;

  IF NOT v_rule_rls THEN
    RAISE EXCEPTION 'search_product_merchandising_rules must have RLS enabled';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polrelid = 'public.search_synonyms'::regclass
      AND polname = 'Merchants manage own search synonyms'
      AND pg_get_expr(polqual, polrelid) ~ 'has_merchant_access\(merchant_id\)'
      AND pg_get_expr(polwithcheck, polrelid) ~ 'has_merchant_access\(merchant_id\)'
  )
    INTO v_synonym_policy_uses_merchant_access;

  IF NOT v_synonym_policy_uses_merchant_access THEN
    RAISE EXCEPTION 'search_synonyms policy must use has_merchant_access for owner and staff access';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polrelid = 'public.search_product_merchandising_rules'::regclass
      AND polname = 'Merchants manage own search merchandising rules'
      AND pg_get_expr(polqual, polrelid) ~ 'has_merchant_access\(merchant_id\)'
      AND pg_get_expr(polwithcheck, polrelid) ~ 'has_merchant_access\(merchant_id\)'
  )
    INTO v_rule_policy_uses_merchant_access;

  IF NOT v_rule_policy_uses_merchant_access THEN
    RAISE EXCEPTION 'search_product_merchandising_rules policy must use has_merchant_access for owner and staff access';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'public.search_synonyms'::regclass
      AND t.tgname = 'search_synonyms_updated_at'
      AND NOT t.tgisinternal
      AND n.nspname = 'public'
      AND p.proname = 'update_updated_at_column'
  )
    INTO v_synonym_updated_at_trigger;

  IF NOT v_synonym_updated_at_trigger THEN
    RAISE EXCEPTION 'search_synonyms must refresh updated_at via update_updated_at_column';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'public.search_product_merchandising_rules'::regclass
      AND t.tgname = 'search_product_merchandising_rules_updated_at'
      AND NOT t.tgisinternal
      AND n.nspname = 'public'
      AND p.proname = 'update_updated_at_column'
  )
    INTO v_rule_updated_at_trigger;

  IF NOT v_rule_updated_at_trigger THEN
    RAISE EXCEPTION 'search_product_merchandising_rules must refresh updated_at via update_updated_at_column';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'public.search_product_merchandising_rules'::regclass
      AND t.tgname = 'search_product_merchandising_rules_product_scope'
      AND NOT t.tgisinternal
      AND n.nspname = 'public'
      AND p.proname = 'enforce_search_merchandising_product_scope'
  )
    INTO v_rule_product_scope_trigger;

  IF NOT v_rule_product_scope_trigger THEN
    RAISE EXCEPTION 'search_product_merchandising_rules must enforce product merchant scope';
  END IF;

  SELECT COALESCE(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=']
    INTO v_rule_product_scope_blank_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'enforce_search_merchandising_product_scope'
    AND pg_get_function_identity_arguments(p.oid) = '';

  IF NOT v_rule_product_scope_blank_search_path THEN
    RAISE EXCEPTION 'enforce_search_merchandising_product_scope must pin a blank search_path';
  END IF;

  SELECT has_table_privilege('anon', 'public.search_synonyms', 'INSERT')
    INTO v_anon_can_insert_synonym;

  IF v_anon_can_insert_synonym THEN
    RAISE EXCEPTION 'search_synonyms must not be insertable by anon';
  END IF;

  SELECT has_table_privilege('authenticated', 'public.search_synonyms', 'INSERT')
    INTO v_authenticated_can_insert_synonym;

  IF NOT v_authenticated_can_insert_synonym THEN
    RAISE EXCEPTION 'search_synonyms must be insertable by authenticated merchants';
  END IF;

  SELECT has_table_privilege('anon', 'public.search_product_merchandising_rules', 'INSERT')
    INTO v_anon_can_insert_rule;

  IF v_anon_can_insert_rule THEN
    RAISE EXCEPTION 'search_product_merchandising_rules must not be insertable by anon';
  END IF;

  SELECT has_table_privilege('authenticated', 'public.search_product_merchandising_rules', 'INSERT')
    INTO v_authenticated_can_insert_rule;

  IF NOT v_authenticated_can_insert_rule THEN
    RAISE EXCEPTION 'search_product_merchandising_rules must be insertable by authenticated merchants';
  END IF;

  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES
    (v_test_merchant_a, 'search-merch-a@example.com', 'Search Merch A', 'search-merch-a'),
    (v_test_merchant_b, 'search-merch-b@example.com', 'Search Merch B', 'search-merch-b');

  INSERT INTO public.products (id, merchant_id, name, price)
  VALUES
    (v_test_product_a, v_test_merchant_a, 'Merchant A Product', 100000),
    (v_test_product_b, v_test_merchant_b, 'Merchant B Product', 100000);

  INSERT INTO public.search_product_merchandising_rules (
    merchant_id,
    query_phrase,
    product_id,
    action
  )
  VALUES (
    v_test_merchant_a,
    'iphone',
    v_test_product_a,
    'boost'
  );

  BEGIN
    INSERT INTO public.search_product_merchandising_rules (
      merchant_id,
      query_phrase,
      product_id,
      action
    )
    VALUES (
      v_test_merchant_a,
      'iphone',
      v_test_product_b,
      'boost'
    );
  EXCEPTION WHEN check_violation THEN
    v_scope_error_seen := true;
  END;

  IF NOT v_scope_error_seen THEN
    RAISE EXCEPTION 'search_product_merchandising_rules must reject cross-merchant product references';
  END IF;
END $$;

ROLLBACK;
```

- [ ] **Step 3: Apply migration and run SQL test**

```bash
supabase db reset
LOCAL_DB_URL="$(supabase status -o env | awk -F= '/^DB_URL=/{print $2}')"
test -n "$LOCAL_DB_URL"
psql "$LOCAL_DB_URL" -f supabase/migrations/tests/storefront_search_merchandising.sql
```

Expected: PASS.

- [ ] **Step 4: Keep ranking integration out of this schema task**

Do not integrate rules into `search_products_v2` in this task. Create a separate accepted merchandising implementation branch after dashboard/UI requirements, real Ogabassey rule data, and latency tests are available. Stop if a proposed rule integration can hide all matching products for a query without an explicit merchant-owned rule and a regression test.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260617123000_storefront_search_merchandising.sql supabase/migrations/tests/storefront_search_merchandising.sql
git commit -m "feat(search): add merchant merchandising rule tables"
```

---

## Task 12: P2 Hybrid Search Experiment

**Files:**
- Modify: `docs/AI_VECTOR_ARCHITECTURE.md`
- Create: `docs/superpowers/specs/2026-06-17-ogabassey-hybrid-search-experiment.md`

- [ ] **Step 1: Write the experiment spec**

Create `docs/superpowers/specs/2026-06-17-ogabassey-hybrid-search-experiment.md`:

```md
# Ogabassey Hybrid Search Experiment Spec

## Goal

Measure whether pgvector + lexical reciprocal rank fusion improves Ogabassey search quality enough to justify production rollout.

## Required Inputs

- P0 merged and deployed.
- P1 query parser and analytics deployed.
- Product embedding coverage report for Ogabassey active products.
- Schema probe confirming `public.products.content_embedding` exists and has usable coverage. Do not target the aspirational `product_embeddings` table from `docs/AI_VECTOR_ARCHITECTURE.md` unless a separate schema migration is approved first.
- Baseline query set from `SEARCH_QUALITY_FIXTURES`.

## Candidate SQL Shape

The experiment creates `search_products_v3_experiment` with:

- Lexical candidates from `search_products_v2`.
- Vector candidates from `public.products.content_embedding`.
- Reciprocal rank fusion score: `1.0 / (60 + lexical_rank) + 1.0 / (60 + vector_rank)`.
- Merchant scoping and status filtering identical to `search_products_v2`.

## Success Gate

- Exact/SKU/model queries do not regress top-3 order.
- Typo and locale queries do not regress.
- Natural-language intent queries improve top-5 relevance by at least 15 percent on the curated fixture set.
- p95 latency remains under the P1 search p95 plus 25 percent.
- No query uses service-role access.

## Stop Rules

- Stop if embedding coverage is below 95 percent of active Ogabassey products.
- Stop if vector index plans are sequential scans at Ogabassey catalog size.
- Stop if exact model queries such as `iphone 16 pro max` rank a non-exact model above an exact model.
```

- [ ] **Step 2: Link the experiment from vector architecture docs**

Append to `docs/AI_VECTOR_ARCHITECTURE.md` under the product-search section:

```md
### Ogabassey Hybrid Search Experiment

See `docs/superpowers/specs/2026-06-17-ogabassey-hybrid-search-experiment.md` before implementing product-search vector fusion. The experiment is gated behind P0/P1 search correctness work and must prove exact-query non-regression before production rollout.

Current schema note: the baseline product vector column is `public.products.content_embedding`. The earlier `product_embeddings` table example in this architecture document is aspirational and is not the implementation target for this experiment unless a separate schema migration is accepted.
```

- [ ] **Step 3: Commit**

```bash
git add docs/AI_VECTOR_ARCHITECTURE.md docs/superpowers/specs/2026-06-17-ogabassey-hybrid-search-experiment.md
git commit -m "docs(search): define Ogabassey hybrid search experiment"
```

---

## Final Verification

- [ ] **Step 1: Run targeted tests**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/search-quality/search-quality-fixtures.test.ts \
  src/lib/search-query-intent.test.ts \
  src/lib/storefront-search.test.ts \
  src/lib/storefront-search-autocomplete.test.ts \
  src/app/api/search/search-security.test.ts \
  src/app/api/storefront/products/route.test.ts \
  src/app/api/agentic/catalog/search/route.test.ts \
  src/ai/chat-tool-handlers.test.ts \
  src/app/api/chat/chat-tool-runtime.test.ts \
  src/app/api/chat/ollama-chat-tool-runtime.test.ts \
  mcp-server/search-products-ranking.test.ts \
  mcp-server/server.test.ts \
  src/components/storefront/search-autocomplete.test.tsx \
  src/app/\(storefront\)/\[slug\]/\(catalog\)/\(listing\)/search/page.test.tsx \
  src/app/\(storefront\)/\[slug\]/\(catalog\)/\(listing\)/search/search-page-content.test.tsx
pnpm --filter baci-mobile-admin exec vitest run lib/product-search.test.ts
pnpm --filter @baci/mobile-storefront exec jest --runInBand hooks/product-utils.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run SQL tests**

```bash
supabase db reset
LOCAL_DB_URL="$(supabase status -o env | awk -F= '/^DB_URL=/{print $2}')"
test -n "$LOCAL_DB_URL"
psql "$LOCAL_DB_URL" -f supabase/migrations/tests/product_search_locale_normalization.sql
psql "$LOCAL_DB_URL" -f supabase/migrations/tests/storefront_search_analytics_aggregates.sql
psql "$LOCAL_DB_URL" -f supabase/migrations/tests/storefront_search_merchandising.sql
```

Expected: PASS.

- [ ] **Step 3: Run full gate**

```bash
pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test
coderabbit review --prompt-only -t uncommitted
```

Expected: PASS, and no critical/high CodeRabbit findings.

- [ ] **Step 4: Run live-safe production probes after deploy**

```bash
OGABASSEY_SEARCH_ORIGIN="https://ogabassey.com" \
OGABASSEY_SEARCH_BASELINE_OUT="output/search/ogabassey-search-production-postdeploy.json" \
node apps/web/tools/search/run-ogabassey-search-baseline.mjs
```

Expected:

Public baseline runner:

- `iphone` returns iPhone products.
- `iphnoe` returns iPhone products or a clickable did-you-mean link.
- `phone under 500k` sends `max_price_filter = 500000` through the shared search helper in tests and returns price-bounded results in the deployed environment.
- Autocomplete and `/search` share the same top ranked products for the same query.

Targeted test proof from Step 1:

- UCP, MCP, and AI chat catalog search return the same top ranked product IDs as storefront search for the same merchant and query.
- Do not treat the public baseline runner as proof for UCP, MCP, or AI chat parity unless a separate credentialed smoke script is added with explicit owner approval and no LLM-triggering chat request.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-17-ogabassey-search-2026-upgrade.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.
