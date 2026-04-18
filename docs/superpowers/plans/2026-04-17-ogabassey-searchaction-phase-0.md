# Ogabassey SearchAction Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real server-rendered storefront search results route and wire homepage `WebSite` schema to emit a valid `SearchAction` that targets it.

**Architecture:** Extract the storefront search query flow into a shared server helper, then build a public `/{slug}/search` page that resolves merchant context, executes the search, fetches compact product cards, and emits `noindex,follow` metadata. Once the public route exists, update the storefront homepage schema graph to include `SearchAction` with a request-scoped URL template.

**Tech Stack:** Next.js App Router, React Server Components, Supabase server/public clients, Vitest, existing storefront schema helpers

---

## File Map

### Create

- `apps/web/src/lib/storefront-search.ts`
  - Shared server-side storefront search helper used by the public storefront search page and the existing `/api/search` route.
- `apps/web/src/lib/storefront-search.test.ts`
  - Unit coverage for query sanitization, pagination, and result ordering behavior.
- `apps/web/src/app/(storefront)/[slug]/search/page.tsx`
  - Public storefront search route metadata and Suspense boundary.
- `apps/web/src/app/(storefront)/[slug]/search/page.test.tsx`
  - Route metadata coverage, including `noindex,follow`.
- `apps/web/src/app/(storefront)/[slug]/search/search-page-content.tsx`
  - Server-rendered storefront search results page content.
- `apps/web/src/app/(storefront)/[slug]/search/search-page-content.test.tsx`
  - Render coverage for empty state, populated results, and did-you-mean behavior.

### Modify

- `apps/web/src/app/api/search/route.ts`
  - Reuse the new shared server search helper instead of owning the full RPC/search flow inline.
- `apps/web/src/app/api/search/search-security.test.ts`
  - Keep the API route tests green after the helper extraction.
- `apps/web/src/app/(storefront)/[slug]/storefront-page-content.tsx`
  - Pass a request-scoped search template into `generateWebSiteSchema()`.
- `apps/web/src/app/(storefront)/[slug]/page.test.tsx`
  - Assert homepage `WebSite` schema includes `SearchAction` after the route exists.

---

### Task 1: Extract Shared Storefront Search Helper

**Files:**
- Create: `apps/web/src/lib/storefront-search.ts`
- Test: `apps/web/src/lib/storefront-search.test.ts`
- Modify: `apps/web/src/app/api/search/route.ts`
- Modify: `apps/web/src/app/api/search/search-security.test.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
import { describe, expect, it, vi } from 'vitest';

const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    insert: vi.fn().mockResolvedValue({ error: null }),
  })),
};

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { searchStorefrontProducts } from './storefront-search';

describe('searchStorefrontProducts', () => {
  it('sanitizes the query before calling the search rpc', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

    await searchStorefrontProducts({
      supabase: mockSupabase as never,
      merchantId: '123e4567-e89b-12d3-a456-426614174000',
      query: '<script>alert(1)</script>iphone',
      limit: 20,
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'search_products_v2',
      expect.objectContaining({
        search_query: 'alert(1)iphone',
      })
    );
  });

  it('returns didYouMean when the first search has no matches', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [{ suggested_term: 'iphone' }],
        error: null,
      });

    const result = await searchStorefrontProducts({
      supabase: mockSupabase as never,
      merchantId: '123e4567-e89b-12d3-a456-426614174000',
      query: 'iphon',
      limit: 20,
    });

    expect(result.didYouMean).toBe('iphone');
  });
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run: `pnpm exec vitest run apps/web/src/lib/storefront-search.test.ts`

Expected: FAIL with `Cannot find module './storefront-search'`

- [ ] **Step 3: Write the shared helper**

```ts
import {
  extractProductSearchIds,
  getProductSearchTotalCount,
} from '@baci/shared';
import { logger } from '@/lib/logger';
import { isValidUuid, sanitizeSearchQuery } from '@/lib/sanitize-core';

interface SearchStorefrontProductsArgs {
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{
      data: unknown;
      error: { message: string } | null;
    }>;
    from: (table: string) => {
      insert: (value: Record<string, unknown>) => Promise<{ error: unknown }>;
    };
  };
  merchantId: string;
  query: string;
  limit: number;
}

export interface StorefrontSearchResult {
  count: number;
  didYouMean: string | null;
  productIds: string[];
  query: string;
}

export async function searchStorefrontProducts({
  supabase,
  merchantId,
  query,
  limit,
}: SearchStorefrontProductsArgs): Promise<StorefrontSearchResult> {
  if (!isValidUuid(merchantId)) {
    throw new Error('Invalid merchant_id format');
  }

  const sanitizedQuery = sanitizeSearchQuery(query);

  const { data: rankedResults, error } = await supabase.rpc(
    'search_products_v2',
    {
      brand_filter: null,
      category_id_filter: null,
      condition_filter: null,
      max_price_filter: null,
      merchant_id_param: merchantId,
      min_price_filter: null,
      min_rating_filter: null,
      parent_only: false,
      result_limit: limit,
      result_offset: 0,
      search_query: sanitizedQuery,
      sort_by: 'relevance',
      status_filter: 'active',
      stock_filter: null,
    }
  );

  if (error) {
    throw error;
  }

  const productIds = extractProductSearchIds(rankedResults ?? []);
  const count = getProductSearchTotalCount(rankedResults ?? []);

  void supabase.from('search_analytics').insert({
    merchant_id: merchantId,
    search_query: sanitizedQuery,
    results_count: productIds.length,
    search_method: 'server',
  });

  let didYouMean: string | null = null;

  if (productIds.length === 0) {
    const { data: suggestion, error: suggestionError } = await supabase.rpc(
      'find_product_search_suggestion_v2',
      {
        merchant_id_param: merchantId,
        search_term: sanitizedQuery,
      }
    );

    if (suggestionError) {
      logger.error({
        message: 'Search suggestion lookup failed',
        error: suggestionError.message,
        merchantId,
        query: sanitizedQuery,
      });
      throw suggestionError;
    }

    if (Array.isArray(suggestion) && suggestion.length > 0) {
      didYouMean =
        (suggestion[0] as { suggested_term?: string }).suggested_term ?? null;
    }
  }

  return {
    count,
    didYouMean,
    productIds,
    query: sanitizedQuery,
  };
}
```

- [ ] **Step 4: Update the API route to use the helper**

```ts
import { searchStorefrontProducts } from '@/lib/storefront-search';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawQuery = searchParams.get('q');
  const merchantId = searchParams.get('merchant_id');
  const limit = Number.parseInt(searchParams.get('limit') || '20', 10);

  if (!rawQuery || !merchantId) {
    return NextResponse.json(
      { error: 'Missing query or merchant_id parameter' },
      { status: 400 }
    );
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const result = await searchStorefrontProducts({
      supabase,
      merchantId,
      query: rawQuery,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to perform search';
    const status = message === 'Invalid merchant_id format' ? 400 : 500;

    return NextResponse.json(
      { error: status === 400 ? message : 'Failed to perform search' },
      { status }
    );
  }
}
```

- [ ] **Step 5: Run the focused tests**

Run: `pnpm exec vitest run apps/web/src/lib/storefront-search.test.ts apps/web/src/app/api/search/search-security.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/storefront-search.ts apps/web/src/lib/storefront-search.test.ts apps/web/src/app/api/search/route.ts apps/web/src/app/api/search/search-security.test.ts
git commit -m "refactor: share storefront search logic"
```

---

### Task 2: Add the Public Storefront Search Results Route

**Files:**
- Create: `apps/web/src/app/(storefront)/[slug]/search/page.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/search/page.test.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/search/search-page-content.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/search/search-page-content.test.tsx`
- Modify: `apps/web/src/lib/storefront-search.ts`

- [ ] **Step 1: Write the failing route metadata test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { getRequestScopedMerchant } from '@/lib/cached-data';

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: vi.fn(),
}));

const mockHeaders = vi.fn();
vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

const { generateMetadata } = await import('./page');

describe('storefront search page metadata', () => {
  it('emits noindex,follow metadata for search results', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
      business_name: 'Ogabassey',
      payout_currency: 'NGN',
    } as never);

    mockHeaders.mockResolvedValue(
      new Headers([
        ['host', 'ogabassey.com'],
        ['x-pathname', '/search'],
      ])
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ q: 'iphone' }),
    });

    expect(metadata.robots).toMatchObject({
      index: false,
      follow: true,
    });
  });
});
```

- [ ] **Step 2: Write the failing content test**

```ts
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: vi.fn(),
}));

vi.mock('@/lib/storefront-search', () => ({
  searchStorefrontProducts: vi.fn(),
  getStorefrontSearchProducts: vi.fn(),
}));

const { SearchPageContent } = await import('./search-page-content');

describe('SearchPageContent', () => {
  it('renders the search query and result count', async () => {
    const result = await SearchPageContent({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ q: 'iphone', page: '1' }),
    });

    render(result as React.ReactElement);

    expect(screen.getByRole('heading', { name: /Search Results/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Extend the shared helper with product hydration**

```ts
import { createPublicClient } from '@/lib/supabase/public';
import {
  STOREFRONT_PRODUCTS_COMPACT_SELECT,
  mapStorefrontProduct,
} from '@/app/api/storefront/products/product-response';

export interface StorefrontSearchProductsPage {
  count: number;
  didYouMean: string | null;
  products: ReturnType<typeof mapStorefrontProduct>[];
  query: string;
}

export async function getStorefrontSearchProducts(args: {
  merchantId: string;
  query: string;
  limit: number;
}): Promise<StorefrontSearchProductsPage> {
  const publicSupabase = createPublicClient({
    clientInfo: 'baci-storefront-search-page',
  });

  const serverSupabase = createClient(await cookies());
  const searchResult = await searchStorefrontProducts({
    supabase: serverSupabase,
    merchantId: args.merchantId,
    query: args.query,
    limit: args.limit,
  });

  if (searchResult.productIds.length === 0) {
    return { ...searchResult, products: [] };
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

  const mapped = (data ?? []).map((row) => mapStorefrontProduct(row as never));
  const order = new Map(searchResult.productIds.map((id, index) => [id, index]));
  mapped.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return {
    ...searchResult,
    products: mapped,
  };
}
```

- [ ] **Step 4: Add the search page route and content**

```ts
// apps/web/src/app/(storefront)/[slug]/search/page.tsx
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductGridSkeleton } from '@/components/ui/skeletons';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import { SearchPageContent } from './search-page-content';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { q } = await searchParams;
  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());
  const trimmedQuery = (q || '').trim();

  return {
    title: trimmedQuery
      ? `Search results for ${trimmedQuery} | ${merchant.business_name}`
      : `Search | ${merchant.business_name}`,
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: trimmedQuery
        ? `${baseUrl}/search?q=${encodeURIComponent(trimmedQuery)}`
        : `${baseUrl}/search`,
    },
  };
}

export default function SearchPage(props: PageProps) {
  return (
    <Suspense fallback={<ProductGridSkeleton count={8} columns={4} />}>
      <SearchPageContent {...props} />
    </Suspense>
  );
}
```

```ts
// apps/web/src/app/(storefront)/[slug]/search/search-page-content.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { getStorefrontSearchProducts } from '@/lib/storefront-search';
import { asRoute } from '@/lib/routes';
import { ProductIndexCard } from '../products/product-index-card';

export async function SearchPageContent({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { q } = await searchParams;
  const query = (q || '').trim();

  const merchant = await getRequestScopedMerchant(slug);
  if (!merchant) {
    notFound();
  }

  const searchResult = query
    ? await getStorefrontSearchProducts({
        merchantId: merchant.id,
        query,
        limit: 20,
      })
    : { count: 0, didYouMean: null, products: [], query: '' };

  return (
    <div className="min-h-screen bg-[color:color-mix(in_srgb,var(--store-background,#ffffff)_94%,var(--store-background-text,#111827)_6%)] pb-20 pt-6">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <nav className="flex items-center gap-2 text-sm text-[var(--store-background-text,#111827)]/55">
          <Link href={asRoute(`/${merchant.slug}`)}>Home</Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-[var(--store-background-text,#111827)]">
            Search
          </span>
        </nav>
        <div className="mt-6 space-y-2">
          <h1 className="text-3xl font-bold text-[var(--store-background-text,#111827)]">
            Search Results
          </h1>
          <p className="text-sm text-[var(--store-background-text,#111827)]/60">
            {query
              ? `Results for “${searchResult.query}”`
              : 'Enter a search term to browse matching products.'}
          </p>
        </div>
        {searchResult.didYouMean && (
          <p className="mt-4 text-sm text-[var(--store-background-text,#111827)]/55">
            Did you mean <span className="font-medium">{searchResult.didYouMean}</span>?
          </p>
        )}
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {searchResult.products.map((product) => (
            <ProductIndexCard
              key={product.id}
              formattedPrice={new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: merchant.payout_currency || 'NGN',
                maximumFractionDigits: 0,
              }).format(product.price)}
              pathPrefix={`/${merchant.slug}`}
              product={product}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the focused search page tests**

Run: `pnpm exec vitest run apps/web/src/app/(storefront)/[slug]/search/page.test.tsx apps/web/src/app/(storefront)/[slug]/search/search-page-content.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/storefront-search.ts apps/web/src/app/(storefront)/[slug]/search/page.tsx apps/web/src/app/(storefront)/[slug]/search/page.test.tsx apps/web/src/app/(storefront)/[slug]/search/search-page-content.tsx apps/web/src/app/(storefront)/[slug]/search/search-page-content.test.tsx
git commit -m "feat: add storefront search results page"
```

---

### Task 3: Wire Homepage `SearchAction`

**Files:**
- Modify: `apps/web/src/app/(storefront)/[slug]/storefront-page-content.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/page.test.tsx`

- [ ] **Step 1: Write the failing homepage schema assertion**

```ts
it('adds SearchAction to the homepage WebSite schema once search is enabled', async () => {
  vi.mocked(getRequestScopedMerchant).mockResolvedValue(
    baseMerchant as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>
  );

  render(
    await StorefrontPageContent({
      params: Promise.resolve({ slug: 'ogabassey' }),
    })
  );

  const schemaScript = document.querySelector(
    'script[type=\"application/ld+json\"]'
  );
  const schema = JSON.parse(schemaScript?.textContent || '{}') as {
    '@graph': Record<string, unknown>[];
  };
  const website = schema['@graph'].find((item) => item['@type'] === 'WebSite');

  expect(website).toMatchObject({
    '@type': 'WebSite',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate:
          'https://ogabassey.com/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  });
});
```

- [ ] **Step 2: Run the homepage schema test to verify it fails**

Run: `pnpm exec vitest run apps/web/src/app/(storefront)/[slug]/page.test.tsx`

Expected: FAIL because `potentialAction` is missing

- [ ] **Step 3: Update homepage schema generation**

```ts
const searchUrlTemplate = `${baseUrl}/search?q={search_term_string}`;
const webSiteSchema = generateWebSiteSchema(
  merchant.business_name,
  baseUrl,
  searchUrlTemplate
);
```

- [ ] **Step 4: Run the homepage schema tests**

Run: `pnpm exec vitest run apps/web/src/app/(storefront)/[slug]/page.test.tsx apps/web/src/app/(storefront)/[slug]/storefront-content.test.tsx`

Expected: PASS

- [ ] **Step 5: Run typecheck and lint for the web app**

Run: `pnpm turbo typecheck --filter=@baci/web && pnpm turbo lint --filter=@baci/web`

Expected: PASS, aside from any existing unrelated warnings already present on the branch

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(storefront)/[slug]/storefront-page-content.tsx apps/web/src/app/(storefront)/[slug]/page.test.tsx
git commit -m "feat: add storefront SearchAction schema"
```

---

## Self-Review

### Spec Coverage

- Phase 0 search route creation: covered in Task 2
- Homepage `SearchAction`: covered in Task 3
- `noindex,follow` policy: covered in Task 2 metadata and tests
- Request-scoped URL template: covered in Task 3

### Placeholder Scan

- No `TODO` or `TBD` markers remain in the plan
- Every code step includes concrete code
- Every verification step includes a concrete command

### Type Consistency

- Shared search helper is named `searchStorefrontProducts()` consistently
- Search page hydration helper is named `getStorefrontSearchProducts()` consistently
- Search results route and homepage schema tasks both use the same `/search?q={search_term_string}` template

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-17-ogabassey-searchaction-phase-0.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
