import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

const mockUseMerchant = jest.fn(() => ({ data: { id: 'merchant-1' } }));
const mockFetchProductsBySlugs = jest.fn(
  async (_merchantId: string, _slugs: readonly string[]) =>
    [{ id: 'p1', slug: 'a27' }] as unknown[]
);

jest.mock('@/hooks/use-merchant', () => ({
  useMerchant: () => mockUseMerchant(),
}));
jest.mock('@/hooks/product-utils', () => ({
  CONSTANT_MERCHANT_ID: 'fallback-merchant',
}));
jest.mock('./product-by-slugs', () => ({
  fetchProductsBySlugs: (merchantId: string, slugs: readonly string[]) =>
    mockFetchProductsBySlugs(merchantId, slugs),
}));

import { usePinnedLaunchProducts } from './use-pinned-launch-products';

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe('usePinnedLaunchProducts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMerchant.mockReturnValue({ data: { id: 'merchant-1' } });
  });

  it('fetches the pinned slugs for the active merchant and returns the data', async () => {
    const { result } = renderHook(
      () => usePinnedLaunchProducts(['a27', 'power80']),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetchProductsBySlugs).toHaveBeenCalledWith('merchant-1', [
      'a27',
      'power80',
    ]);
    expect(result.current.data).toEqual([{ id: 'p1', slug: 'a27' }]);
  });

  it('stays disabled (no fetch) when there are no slugs', () => {
    const { result } = renderHook(() => usePinnedLaunchProducts([]), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchProductsBySlugs).not.toHaveBeenCalled();
  });

  it('surfaces an error state when the pinned fetch fails', async () => {
    const boom = new Error('boom');
    mockFetchProductsBySlugs.mockRejectedValueOnce(boom);

    const { result } = renderHook(() => usePinnedLaunchProducts(['a27']), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
  });
});
