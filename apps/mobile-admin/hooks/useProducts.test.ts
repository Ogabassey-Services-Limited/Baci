import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  getUseProductsMocks,
  resetUseProductsMocks,
} from './useProducts.test-setup';

const mocks = getUseProductsMocks();
let useInventoryStats: typeof import('./useProducts').useInventoryStats;
let useProduct: typeof import('./useProducts').useProduct;
let useProducts: typeof import('./useProducts').useProducts;
let useUpdateProduct: typeof import('./useProducts').useUpdateProduct;
let useUpdateProductStock: typeof import('./useProducts').useUpdateProductStock;

describe('useProducts branch and query semantics', () => {
  beforeAll(async () => {
    ({
      useInventoryStats,
      useProduct,
      useProducts,
      useUpdateProduct,
      useUpdateProductStock,
    } = await import('./useProducts'));
  });

  beforeEach(resetUseProductsMocks);

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

  it('invalidates the product list and changed product after stock updates settle', async () => {
    useUpdateProductStock();

    const context = await mocks.mutationConfigs[0]?.onMutate?.({
      productId: 'product-1',
      stock: 7,
    });
    await mocks.mutationConfigs[0]?.onSettled?.(
      undefined,
      undefined,
      { productId: 'product-1', stock: 7 },
      context
    );

    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('uses unscoped product keys after a stock update settles without merchant context', async () => {
    mocks.merchant = null;
    useUpdateProductStock();

    await mocks.mutationConfigs[0]?.onSettled?.(undefined, undefined, {
      productId: 'product-1',
      stock: 7,
    });

    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products'],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product'],
    });
  });

  it('keeps a pending stock mutation scoped to its originating merchant after a merchant switch', async () => {
    const variables = { productId: 'product-1', stock: 7 };
    useUpdateProductStock();
    const context = await mocks.mutationConfigs[0]?.onMutate?.(variables);

    mocks.merchant = { id: 'merchant-2' };
    useUpdateProductStock();
    await mocks.mutationConfigs[1]?.onSettled?.(
      undefined,
      undefined,
      variables,
      context
    );

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
  });

  it('forwards previous category snapshots into updateProductRecord', async () => {
    mocks.updateProductRecord.mockResolvedValue({ id: 'product-1' });
    useUpdateProduct();

    await mocks.mutationConfigs[0]?.mutationFn?.({
      id: 'product-1',
      updates: { name: 'iPhone 15' },
      previousCategory: 'Smartphones',
      previousCategoryId: 'cat-old',
    });

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
