import { describe, expect, it, vi } from 'vitest';
import {
  invalidateVariantInventoryQueries,
  toInventoryMutationError,
} from './useVariantInventoryInvalidation';

function createQueryClient() {
  return {
    invalidateQueries: vi.fn(),
  } as unknown as Parameters<typeof invalidateVariantInventoryQueries>[0];
}

describe('invalidateVariantInventoryQueries', () => {
  it('invalidates merchant-scoped inventory queries when merchant id is missing', () => {
    const queryClient = createQueryClient();

    invalidateVariantInventoryQueries(queryClient, undefined);

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['variant-inventory', undefined],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', undefined],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inventory-stats', undefined],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(3);
  });

  it('does not invalidate a product detail query when product id is missing', () => {
    const queryClient = createQueryClient();

    invalidateVariantInventoryQueries(queryClient, 'merchant-1');

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['variant-inventory', 'merchant-1'],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inventory-stats', 'merchant-1'],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(3);
  });

  it('invalidates product detail when product id is provided', () => {
    const queryClient = createQueryClient();

    invalidateVariantInventoryQueries(queryClient, 'merchant-1', 'product-1');

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(4);
  });
});

describe('toInventoryMutationError', () => {
  it('preserves a provided error message', () => {
    expect(toInventoryMutationError({ message: 'Bad unit' }).message).toBe(
      'Bad unit'
    );
  });

  it('uses a default message when no error message is present', () => {
    expect(toInventoryMutationError({}).message).toBe(
      'Inventory mutation failed'
    );
  });
});
