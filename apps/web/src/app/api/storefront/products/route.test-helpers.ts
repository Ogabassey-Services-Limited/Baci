import { vi } from 'vitest';

type MockProductsQuery = {
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
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

const mockProductsByIdsQuery = {
  current: null as MockProductsByIdsQuery | null,
};

const mockProductsByIdsQueries = {
  current: [] as MockProductsByIdsQuery[],
};

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
    order: vi.fn(() => Promise.resolve(mockProductsResult.current)),
  };

  mockProductsQuery.current = query;

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
  mockProductsByIdsQuery.current = null;
  mockProductsByIdsQueries.current = [];
  mockProductsResult.current = {
    data: [],
    error: null,
  };
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
  mockProductsResult,
  mockSearchRpc,
  createRawProduct,
  reset,
} as const;
