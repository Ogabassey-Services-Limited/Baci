import { render, waitFor } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProductFetch } from './use-product-fetch';

const pagination = {
  limit: 20,
  page: 1,
  total: 0,
  totalPages: 0,
};

const stats = {
  categoryCount: 0,
  inventoryValue: 0,
  outOfStockCount: 0,
};

const filters = {
  migration: 'All',
  search: '',
  status: 'All',
  stock: 'All',
} as const;

function Harness({
  searchTerm,
  triggerFetchInLayout = false,
}: {
  searchTerm: string;
  triggerFetchInLayout?: boolean;
}) {
  const { fetchProducts } = useProductFetch({
    authLoading: false,
    initialData: {
      filters,
      pagination,
      products: [],
      stats,
    },
    migrationFilter: 'all',
    pagination,
    searchTerm,
    setIsLoading: vi.fn(),
    setPagination: vi.fn(),
    setProducts: vi.fn(),
    setStats: vi.fn(),
    statusFilter: 'all',
    stockFilter: 'all',
    toast: vi.fn(),
    user: { id: 'user-1' },
  });

  useLayoutEffect(() => {
    if (triggerFetchInLayout) {
      void fetchProducts(true);
    }
  }, [fetchProducts, triggerFetchInLayout]);

  return null;
}

describe('useProductFetch', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        filters,
        pagination,
        products: [],
        stats,
      }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('uses latest query state when a caller refetches during layout effects', async () => {
    const { rerender } = render(<Harness searchTerm="old" />);
    fetchMock.mockClear();

    rerender(<Harness searchTerm="new" triggerFetchInLayout={true} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain('search=new');
  });
});
