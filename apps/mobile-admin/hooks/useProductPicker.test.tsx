import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseDebounce = vi.fn();
const mockUseProducts = vi.fn();

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: string, delay: number) => mockUseDebounce(value, delay),
}));

vi.mock('@/hooks/useProducts', () => ({
  useProducts: (filters: { search?: string }) => mockUseProducts(filters),
}));

import { useProductPicker } from './useProductPicker';

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children?: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useProductPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDebounce.mockImplementation((value: string) => value);
    mockUseProducts.mockReturnValue({
      data: {
        pages: [
          { products: [{ id: 'prod-1', name: 'iPhone 14 Pro' }] },
          { products: [{ id: 'prod-2', name: 'iPhone 14 Pro Max' }] },
        ],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
      isLoading: false,
    });
  });

  it('delegates searching to useProducts and flattens paged results', () => {
    const { result } = renderHook(
      () => useProductPicker('  iphone 14 promax  '),
      {
        wrapper: createWrapper(),
      }
    );

    expect(mockUseDebounce).toHaveBeenCalledWith('  iphone 14 promax  ', 250);
    expect(mockUseProducts).toHaveBeenCalledWith({
      search: 'iphone 14 promax',
    });
    expect(result.current.products).toEqual([
      { id: 'prod-1', name: 'iPhone 14 Pro' },
      { id: 'prod-2', name: 'iPhone 14 Pro Max' },
    ]);
  });

  it('omits the search filter when the query is empty', () => {
    renderHook(() => useProductPicker('   '), {
      wrapper: createWrapper(),
    });

    expect(mockUseProducts).toHaveBeenCalledWith({ search: undefined });
  });
});
