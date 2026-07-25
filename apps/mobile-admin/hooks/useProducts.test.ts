import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chainCalls: [] as Array<{ method: string; args: unknown[] }>,
  createProductRecord: vi.fn(),
  fetchProductDetail: vi.fn(),
  infiniteQueryConfigs: [] as Array<{
    queryFn: (args: { pageParam?: number }) => Promise<unknown>;
    queryKey: readonly unknown[];
    staleTime?: number;
  }>,
  mutationConfigs: [] as Array<{
    mutationFn?: (variables: unknown) => unknown;
    onSettled?: (
      data: unknown,
      error: unknown,
      variables: { productId: string; stock: number }
    ) => void;
  }>,
  updateProductRecord: vi.fn(),
  productQueryResult: {
    count: 0,
    data: [] as unknown[],
    error: null as { message: string } | null,
  },
  queryClient: {
    cancelQueries: vi.fn(),
    getQueriesData: vi.fn(() => []),
    invalidateQueries: vi.fn(),
    setQueriesData: vi.fn(),
    setQueryData: vi.fn(),
  },
  queryConfigs: [] as Array<{
    enabled?: boolean;
    queryFn: () => Promise<unknown>;
    queryKey: readonly unknown[];
    staleTime?: number;
  }>,
  queryPromises: [] as Promise<unknown>[],
  rpc: vi.fn(),
}));

function makeProductQuery() {
  const chain: Record<string, unknown> = {};
  const passthrough =
    (method: string) =>
    (...args: unknown[]) => {
      mocks.chainCalls.push({ method, args });
      return chain;
    };

  for (const method of [
    'select',
    'eq',
    'is',
    'order',
    'range',
    'lte',
    'gt',
    'or',
  ]) {
    chain[method] = passthrough(method);
  }
  // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are thenable.
  chain.then = (
    resolve: (value: {
      data: unknown[];
      count: number;
      error: { message: string } | null;
    }) => unknown
  ) => Promise.resolve(mocks.productQueryResult).then(resolve);
  return chain;
}

vi.mock('@tanstack/react-query', () => ({
  keepPreviousData: Symbol('keepPreviousData'),
  useInfiniteQuery: (config: {
    queryFn: (args: { pageParam?: number }) => Promise<unknown>;
    queryKey: readonly unknown[];
    staleTime?: number;
  }) => {
    mocks.infiniteQueryConfigs.push(config);
    mocks.queryPromises.push(config.queryFn({ pageParam: 0 }));
    return {};
  },
  useMutation: (config: {
    mutationFn?: (variables: unknown) => unknown;
    onSettled?: (
      data: unknown,
      error: unknown,
      variables: { productId: string; stock: number }
    ) => void;
  }) => {
    mocks.mutationConfigs.push(config);
    return {};
  },
  useQuery: (config: {
    enabled?: boolean;
    queryFn: () => Promise<unknown>;
    queryKey: readonly unknown[];
    staleTime?: number;
  }) => {
    mocks.queryConfigs.push(config);
    mocks.queryPromises.push(config.queryFn());
    return {};
  },
  useQueryClient: () => mocks.queryClient,
}));

// B1-lite: createCategory now posts to the web Route Handler (which owns
// revalidation + edge purge) instead of inserting directly, so the api-client
// must be mocked — importing it for real pulls in RN transport internals the
// test environment cannot load.
vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn().mockResolvedValue({
    category: { id: 'category-1', name: 'Phones', slug: 'phones' },
  }),
}));

vi.mock('@/lib/revalidate-storefront-products', () => ({
  revalidateStorefrontProducts: vi.fn(),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('@/hooks/useBranchScope', () => ({
  useBranchScope: () => ({
    scope: { type: 'branch', branchId: 'branch-1' },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => makeProductQuery(),
    rpc: mocks.rpc,
  },
}));

vi.mock('./product-detail-query', () => ({
  fetchProductDetail: mocks.fetchProductDetail,
}));

vi.mock('./product-save', () => ({
  createProductRecord: mocks.createProductRecord,
  updateProductRecord: mocks.updateProductRecord,
}));

import {
  useInventoryStats,
  useProduct,
  useProducts,
  useUpdateProduct,
  useUpdateProductStock,
} from './useProducts';

describe('useProducts branch semantics', () => {
  beforeEach(() => {
    mocks.chainCalls.length = 0;
    mocks.infiniteQueryConfigs.length = 0;
    mocks.mutationConfigs.length = 0;
    mocks.queryConfigs.length = 0;
    mocks.queryPromises.length = 0;
    mocks.fetchProductDetail.mockReset();
    mocks.productQueryResult = { count: 0, data: [], error: null };
    mocks.queryClient.cancelQueries.mockReset();
    mocks.queryClient.getQueriesData.mockReset();
    mocks.queryClient.getQueriesData.mockReturnValue([]);
    mocks.queryClient.invalidateQueries.mockReset();
    mocks.queryClient.setQueriesData.mockReset();
    mocks.queryClient.setQueryData.mockReset();
    mocks.rpc.mockReset();
    mocks.createProductRecord.mockReset();
    mocks.updateProductRecord.mockReset();
  });

  it('does not add branch_id filters to merchant-wide product catalog queries', () => {
    useProducts();

    expect(mocks.chainCalls.length).toBeGreaterThan(0);
    expect(
      mocks.chainCalls.filter(
        (call) => call.method === 'eq' && call.args[0] === 'branch_id'
      )
    ).toEqual([]);
  });

  it('scopes product list query keys by merchant id while preserving filters', () => {
    const filters = { status: 'active' as const };

    useProducts(filters);

    expect(mocks.infiniteQueryConfigs[0]?.queryKey).toEqual([
      'products',
      'merchant-1',
      filters,
    ]);
  });

  it('scopes product detail query keys by merchant id with a short freshness window', () => {
    mocks.fetchProductDetail.mockResolvedValue({ id: 'product-1' });

    useProduct('product-1');

    expect(mocks.queryConfigs[0]).toMatchObject({
      enabled: true,
      queryKey: ['product', 'merchant-1', 'product-1'],
      staleTime: 1000 * 30,
    });
  });

  it('invalidates the product list and changed product after stock updates settle', () => {
    useUpdateProductStock();

    mocks.mutationConfigs[0]?.onSettled?.(undefined, undefined, {
      productId: 'product-1',
      stock: 7,
    });

    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
  });

  it('calls inventory stats RPC only with merchant id', () => {
    mocks.rpc.mockResolvedValue({ data: {}, error: null });

    useInventoryStats();

    expect(mocks.rpc).toHaveBeenCalledWith('get_merchant_inventory_stats', {
      p_merchant_id: 'merchant-1',
    });
  });

  it('surfaces inventory stats RPC errors', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'rpc-failed' },
    });

    useInventoryStats();

    await expect(mocks.queryPromises[0]).rejects.toEqual({
      message: 'rpc-failed',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('get_merchant_inventory_stats', {
      p_merchant_id: 'merchant-1',
    });
  });

  it('forwards previousCategory/previousCategoryId into updateProductRecord', async () => {
    mocks.updateProductRecord.mockResolvedValue({ id: 'product-1' });

    useUpdateProduct();

    const config = mocks.mutationConfigs[0];
    expect(config?.mutationFn).toBeDefined();

    await config?.mutationFn?.({
      id: 'product-1',
      updates: { name: 'iPhone 15' },
      previousCategory: 'Smartphones',
      previousCategoryId: 'cat-old',
    });

    // The category MOVE snapshot must reach the save layer so the OLD category's
    // cached storefront URLs are also purged.
    expect(mocks.updateProductRecord).toHaveBeenCalledWith({
      id: 'product-1',
      merchantId: 'merchant-1',
      updates: { name: 'iPhone 15' },
      previousCategory: 'Smartphones',
      previousCategoryId: 'cat-old',
    });
  });

  it('surfaces product query errors without adding branch filters', async () => {
    mocks.productQueryResult = {
      count: 0,
      data: [],
      error: { message: 'query-failed' },
    };

    useProducts();

    await expect(mocks.queryPromises[0]).rejects.toThrow('query-failed');
    expect(
      mocks.chainCalls.filter(
        (call) => call.method === 'eq' && call.args[0] === 'branch_id'
      )
    ).toEqual([]);
  });
});

describe('useCreateCategory slug generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Named `use*` so the hook call inside satisfies the rules-of-hooks lint,
  // matching how the suite already calls useProducts() directly.
  async function useCategoryCreate(name: string) {
    const { useCreateCategory } = await import('./useProducts');
    // The useMutation mock records each config; the last one is this hook's.
    mocks.mutationConfigs.length = 0;
    useCreateCategory();
    const config = mocks.mutationConfigs.at(-1);
    if (!config?.mutationFn) throw new Error('mutationFn not registered');
    return config.mutationFn(name);
  }

  it('posts a route-compatible slug derived from the name', async () => {
    const { apiClient } = await import('@/lib/api-client');

    await useCategoryCreate('Mobile Phones');

    expect(apiClient).toHaveBeenCalledWith(
      '/api/merchant/categories',
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse(
      (vi.mocked(apiClient).mock.calls[0]?.[1] as { body: string }).body
    );
    expect(body.slug).toBe('mobile-phones');
  });

  describe('bugfix: names with no ASCII characters produced an empty slug', () => {
    it('fails locally with an actionable message instead of POSTing a 400', async () => {
      const { apiClient } = await import('@/lib/api-client');

      // The old inline generator turned 手机 into '' and the route answered 400.
      await expect(useCategoryCreate('手机')).rejects.toThrow(
        /letters or numbers/i
      );
      expect(apiClient).not.toHaveBeenCalled();
    });

    it('bounds a very long name to the slug maximum the route accepts', async () => {
      const { apiClient } = await import('@/lib/api-client');

      await useCategoryCreate(`${'word '.repeat(60)}end`);

      const body = JSON.parse(
        (vi.mocked(apiClient).mock.calls[0]?.[1] as { body: string }).body
      );
      expect(body.slug.length).toBeLessThanOrEqual(120);
      expect(body.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    });
  });
});
