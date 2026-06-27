import { vi } from 'vitest';

type ProductsQueryResult = {
  data: Record<string, unknown>[];
  error: { message: string } | null;
};

type MockProductsQuery = {
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
};

type MockProductsByIdsQuery = {
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
};

const mockProductsResult = {
  current: {
    data: [] as Record<string, unknown>[],
    error: null as { message: string } | null,
  },
};

const mockProductsResults = {
  current: [] as ProductsQueryResult[],
};

const mockProductsByIdsResult = {
  current: {
    data: [] as Record<string, unknown>[],
    error: null as { message: string } | null,
  },
};

const mockProductsByIdsResults = {
  current: [] as Array<{
    data: Record<string, unknown>[];
    error: { message: string } | null;
  }>,
};

const mockSearchRpc = {
  current: vi.fn(),
};

const mockProductsQuery = {
  current: null as MockProductsQuery | null,
};

const mockProductsQueries = {
  current: [] as MockProductsQuery[],
};

const mockProductsByIdsQuery = {
  current: null as MockProductsByIdsQuery | null,
};

const mockProductsByIdsQueries = {
  current: [] as MockProductsByIdsQuery[],
};

function resolveProductsResult(): Promise<ProductsQueryResult> {
  return Promise.resolve(
    mockProductsResults.current.shift() ?? mockProductsResult.current
  );
}

function createProductsQuery() {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    or: vi.fn(() => query),
    ilike: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    not: vi.fn(() => query),
    limit: vi.fn(() => query),
    range: vi.fn(() => query),
    order: vi.fn(() => query),
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are intentionally awaitable thenables.
    then: vi.fn(
      (
        onFulfilled?: (value: ProductsQueryResult) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => resolveProductsResult().then(onFulfilled, onRejected)
    ),
  };

  mockProductsQuery.current = query;
  mockProductsQueries.current.push(query);

  return query;
}

function createProductsByIdsQuery() {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() =>
      Promise.resolve(
        mockProductsByIdsResults.current.shift() ??
          mockProductsByIdsResult.current
      )
    ),
  };

  mockProductsByIdsQuery.current = query;
  mockProductsByIdsQueries.current.push(query);

  return query;
}

const mockCreateStaticClient = vi.fn(() => ({
  from: vi.fn((table: string) => {
    if (table === 'products') {
      return createProductsQuery();
    }

    throw new Error(`Unexpected table: ${table}`);
  }),
}));

const mockCreateServerClient = vi.fn(() => ({
  rpc: (...args: unknown[]) => mockSearchRpc.current(...args),
  from: vi.fn((table: string) => {
    if (table === 'products') {
      return createProductsByIdsQuery();
    }

    throw new Error(`Unexpected table: ${table}`);
  }),
}));

function createRawProduct(overrides: Partial<Record<string, unknown>>) {
  return {
    id: 'product-1',
    name: 'Sony Bravia',
    description: '4K TV',
    price: 900000,
    compare_at_price: null,
    images: ['https://cdn.example.com/tv.jpg'],
    image_hint: 'television',
    category: 'Smart TVs',
    categories: { id: 'cat-1', name: 'Smart TVs', slug: 'smart-tvs' },
    brand: 'Sony',
    stock: 4,
    stock_quantity: 4,
    slug: 'sony-bravia',
    status: 'active',
    condition: 'new',
    has_variants: false,
    sku: 'TV-1',
    manage_stock: true,
    low_stock_threshold: 1,
    colors: ['Black'],
    has_condition_offers: false,
    available_conditions: ['new'],
    ...overrides,
  };
}

function reset() {
  vi.clearAllMocks();
  mockProductsQuery.current = null;
  mockProductsQueries.current = [];
  mockProductsByIdsQuery.current = null;
  mockProductsByIdsQueries.current = [];
  mockProductsResult.current = {
    data: [],
    error: null,
  };
  mockProductsResults.current = [];
  mockProductsByIdsResult.current = {
    data: [],
    error: null,
  };
  mockProductsByIdsResults.current = [];
  mockSearchRpc.current = vi.fn();
}

export const storefrontProductsRouteTestHarness = {
  mockCreateStaticClient,
  mockCreateServerClient,
  mockProductsByIdsQueries,
  mockProductsByIdsQuery,
  mockProductsByIdsResult,
  mockProductsByIdsResults,
  mockProductsQuery,
  mockProductsQueries,
  mockProductsResult,
  mockProductsResults,
  mockSearchRpc,
  createRawProduct,
  reset,
} as const;
