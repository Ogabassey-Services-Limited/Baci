import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chainCalls: [] as Array<{ method: string; args: unknown[] }>,
  createProductRecord: vi.fn(),
  invalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
  merchant: { id: 'merchant-1' } as { id: string } | null,
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
    onSuccess?: (data: unknown, variables: Record<string, unknown>) => unknown;
  }>,
  updateProductStatus: vi.fn(),
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
    onSuccess?: (data: unknown, variables: Record<string, unknown>) => unknown;
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
// origin cache revalidation) instead of inserting directly, so the api-client
// must be mocked — importing it for real pulls in RN transport internals the
// test environment cannot load.
vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn().mockResolvedValue({
    category: { id: 'category-1', name: 'Phones', slug: 'phones' },
  }),
}));

vi.mock('@/lib/invalidate-store-readiness', () => ({
  invalidateStoreReadiness: mocks.invalidateStoreReadiness,
}));

vi.mock('@/lib/revalidate-storefront-products', () => ({
  revalidateStorefrontProducts: vi.fn(),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: mocks.merchant }),
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

vi.mock('./products-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./products-data')>();
  return { ...actual, updateProductStatus: mocks.updateProductStatus };
});

import {
  useCreateProduct,
  useInventoryStats,
  useProduct,
  useProducts,
  useUpdateProduct,
  useUpdateProductStatus,
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
    mocks.merchant = { id: 'merchant-1' };
    mocks.productQueryResult = { count: 0, data: [], error: null };
    mocks.queryClient.cancelQueries.mockReset();
    mocks.queryClient.getQueriesData.mockReset();
    mocks.queryClient.getQueriesData.mockReturnValue([]);
    mocks.queryClient.invalidateQueries.mockReset();
    mocks.queryClient.setQueriesData.mockReset();
    mocks.queryClient.setQueryData.mockReset();
    mocks.rpc.mockReset();
    mocks.createProductRecord.mockReset();
    mocks.invalidateStoreReadiness.mockReset();
    mocks.invalidateStoreReadiness.mockResolvedValue(undefined);
    mocks.updateProductStatus.mockReset();
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
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('invalidates readiness only when a created product is active', async () => {
    useCreateProduct();

    await mocks.mutationConfigs[0]?.onSuccess?.(
      { id: 'product-1', status: 'active' },
      {}
    );

    expect(mocks.invalidateStoreReadiness).toHaveBeenCalledWith(
      mocks.queryClient,
      'merchant-1'
    );
  });

  it('does not invalidate readiness when a created product remains a draft', async () => {
    useCreateProduct();

    await mocks.mutationConfigs[0]?.onSuccess?.(
      { id: 'product-1', status: 'draft' },
      {}
    );

    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('preserves an active product create when only readiness refresh fails', async () => {
    mocks.invalidateStoreReadiness.mockRejectedValueOnce(
      new Error('Readiness refresh failed')
    );
    useCreateProduct();

    await expect(
      mocks.mutationConfigs[0]?.onSuccess?.(
        { id: 'product-1', status: 'active' },
        {}
      )
    ).resolves.toBeUndefined();

    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
  });

  it('co-starts and awaits product-list and readiness refreshes for an active create', async () => {
    const releases: Array<() => void> = [];
    const deferred = () =>
      new Promise<void>((resolve) => releases.push(resolve));
    mocks.queryClient.invalidateQueries.mockImplementation(deferred);
    mocks.invalidateStoreReadiness.mockImplementation(deferred);
    useCreateProduct();
    let completed = false;
    const completion = Promise.resolve(
      mocks.mutationConfigs[0]?.onSuccess?.(
        { id: 'product-1', status: 'active' },
        {}
      )
    ).then(() => {
      completed = true;
    });

    expect(releases).toHaveLength(2);
    expect(completed).toBe(false);
    for (const release of releases) release();
    await completion;
    expect(completed).toBe(true);
  });

  it('does not invalidate readiness after a failed product create', async () => {
    mocks.createProductRecord.mockRejectedValueOnce(new Error('Create failed'));
    useCreateProduct();

    await expect(mocks.mutationConfigs[0]?.mutationFn?.({})).rejects.toThrow(
      'Create failed'
    );

    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('invalidates readiness only for a status field update and awaits it with product invalidations', async () => {
    let releaseReadiness!: () => void;
    const readiness = new Promise<void>((resolve) => {
      releaseReadiness = resolve;
    });
    mocks.invalidateStoreReadiness.mockReturnValueOnce(readiness);
    useUpdateProduct();

    await mocks.mutationConfigs[0]?.onSuccess?.(
      { id: 'product-1' },
      { updates: { name: 'Renamed product' } }
    );
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();

    let completed = false;
    const completion = Promise.resolve(
      mocks.mutationConfigs[0]?.onSuccess?.(
        { id: 'product-1' },
        { updates: { status: 'active' } }
      )
    );
    completion?.then(() => {
      completed = true;
    });

    await Promise.resolve();
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
    expect(mocks.invalidateStoreReadiness).toHaveBeenCalledWith(
      mocks.queryClient,
      'merchant-1'
    );
    expect(completed).toBe(false);

    releaseReadiness();
    await completion;
    expect(completed).toBe(true);
  });

  it('preserves a saved product update when only readiness refresh fails', async () => {
    mocks.invalidateStoreReadiness.mockRejectedValueOnce(
      new Error('Readiness refresh failed')
    );
    useUpdateProduct();

    await expect(
      mocks.mutationConfigs[0]?.onSuccess?.(
        { id: 'product-1' },
        { updates: { status: 'active' } }
      )
    ).resolves.toBeUndefined();

    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
  });

  it('invalidates readiness after a successful product status change', async () => {
    useUpdateProductStatus();

    await mocks.mutationConfigs[0]?.onSuccess?.(
      { id: 'product-1' },
      { productId: 'product-1', status: 'active' }
    );

    expect(mocks.invalidateStoreReadiness).toHaveBeenCalledWith(
      mocks.queryClient,
      'merchant-1'
    );
  });

  it('preserves a successful status update when only readiness refresh fails', async () => {
    mocks.invalidateStoreReadiness.mockRejectedValueOnce(
      new Error('Readiness refresh failed')
    );
    useUpdateProductStatus();

    await expect(
      mocks.mutationConfigs[0]?.onSuccess?.(
        { id: 'product-1' },
        { productId: 'product-1', status: 'active' }
      )
    ).resolves.toBeUndefined();

    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
  });

  it('invalidates product list and detail caches after a persisted status update without merchant context', async () => {
    mocks.merchant = null;
    useUpdateProductStatus();

    await mocks.mutationConfigs[0]?.onSuccess?.(
      { id: 'product-1' },
      { productId: 'product-1', status: 'active' }
    );

    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products'],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product'],
    });
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('does not invalidate product or readiness queries when a status mutation fails', async () => {
    const failure = new Error('Status update failed');
    mocks.updateProductStatus.mockRejectedValueOnce(failure);
    useUpdateProductStatus();
    const mutation = mocks.mutationConfigs[0]?.mutationFn;

    await expect(
      mutation?.({ productId: 'product-1', status: 'active' })
    ).rejects.toBe(failure);

    expect(mocks.queryClient.invalidateQueries).not.toHaveBeenCalled();
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('co-starts and awaits list, detail, and readiness refreshes for an explicit status mutation', async () => {
    const releases: Array<() => void> = [];
    const deferred = () =>
      new Promise<void>((resolve) => releases.push(resolve));
    mocks.queryClient.invalidateQueries.mockImplementation(deferred);
    mocks.invalidateStoreReadiness.mockImplementation(deferred);
    useUpdateProductStatus();
    let completed = false;
    const completion = Promise.resolve(
      mocks.mutationConfigs[0]?.onSuccess?.(
        {},
        { productId: 'product-1', status: 'active' }
      )
    ).then(() => {
      completed = true;
    });

    expect(releases).toHaveLength(3);
    expect(completed).toBe(false);
    for (const release of releases) release();
    await completion;
    expect(completed).toBe(true);
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
    // cached storefront data is also revalidated.
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
