import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductProvider, useProductContext } from '@/contexts/product-context';
import type { Product } from '@/lib/products';
import type { ProductsResult } from '@/lib/products-server';

vi.mock('./auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    loading: false,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/api-client', () => ({
  apiDelete: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

const productFixture: Product = {
  id: 'product-1',
  name: 'PlayStation 5',
  description: 'Console',
  status: 'active',
  price: 500000,
  manage_stock: true,
  stock: 4,
  image: '/ps5.jpg',
  imageLarge: '/ps5-large.jpg',
  imageHint: '',
  brand: 'Sony',
  gtin: '',
  mpn: '',
};

const initialDataFixture: ProductsResult = {
  products: [productFixture],
  filters: {
    migration: 'needs_review',
    status: 'draft',
    stock: 'out_of_stock',
    search: 'ps5',
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  },
  stats: {
    inventoryValue: 500000,
    outOfStockCount: 0,
    categoryCount: 1,
  },
};

function ProductContextProbe() {
  const { migrationFilter, statusFilter, stockFilter, searchTerm } =
    useProductContext();

  return (
    <div>
      <span>{migrationFilter}</span>
      <span>{statusFilter}</span>
      <span>{stockFilter}</span>
      <span>{searchTerm}</span>
    </div>
  );
}

describe('ProductProvider', () => {
  it('hydrates filter state from server data', () => {
    render(
      <ProductProvider initialData={initialDataFixture}>
        <ProductContextProbe />
      </ProductProvider>
    );

    expect(screen.getByText('needs_review')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText('out_of_stock')).toBeInTheDocument();
    expect(screen.getByText('ps5')).toBeInTheDocument();
  });

  it('throws when the hook is used outside the provider', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(() => render(<ProductContextProbe />)).toThrow(
      'useProductContext must be used within a ProductProvider'
    );

    consoleError.mockRestore();
  });
});

describe('ProductProvider — search debounce + filter flush', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  // Probe that exposes setters so tests can drive context state.
  type ProbeRefs = {
    setSearchTerm: (value: string) => void;
    setStatusFilter: (value: 'All' | 'active' | 'draft' | 'archived') => void;
    setPage: (page: number) => void;
  };

  const refs: ProbeRefs = {
    setSearchTerm: () => undefined,
    setStatusFilter: () => undefined,
    setPage: () => undefined,
  };

  function CapturingProbe() {
    const ctx = useProductContext();
    refs.setSearchTerm = ctx.setSearchTerm;
    refs.setStatusFilter = ctx.setStatusFilter;
    refs.setPage = ctx.setPage;
    return null;
  }

  // Helper: read a query param of the most recent fetch call.
  const lastFetchParam = (key: string): string | null => {
    const calls = fetchSpy.mock.calls;
    if (calls.length === 0) return null;
    const url = String(calls[calls.length - 1]?.[0] ?? '');
    const params = new URL(url, 'http://localhost').searchParams;
    return params.get(key);
  };

  // Drain pending microtasks; needed because fetchSpy.mockResolvedValue
  // resolves via the microtask queue and useEffectEvent-driven fetches
  // are awaited internally.
  const flushMicrotasks = async () => {
    // Two passes cover: (1) the resolved fetch promise, (2) the .json() promise.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  // act() requires an async callback when we need React to await it (so that
  // any flushed effects can resolve their promises). The callback is async
  // intentionally even though it only calls a sync timer advance — without
  // `async`, RTL would treat it as sync-mode act and skip the effect-flush
  // await chain. We use the `await Promise.resolve()` to satisfy the linter.
  const advanceTimers = async (ms: number) => {
    await act(async () => {
      vi.advanceTimersByTime(ms);
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        products: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        stats: { inventoryValue: 0, outOfStockCount: 0, categoryCount: 0 },
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchSpy.mockReset();
  });

  it('does not refetch immediately on each keystroke — debounces search input', async () => {
    // Arrange: start with hydrated initialData so the first effect skips the fetch.
    render(
      <ProductProvider initialData={initialDataFixture}>
        <CapturingProbe />
      </ProductProvider>
    );

    // Sanity: initial render should not have triggered a network fetch.
    expect(fetchSpy).not.toHaveBeenCalled();

    // Act: type three characters quickly.
    act(() => {
      refs.setSearchTerm('p');
    });
    act(() => {
      refs.setSearchTerm('ph');
    });
    act(() => {
      refs.setSearchTerm('pho');
    });

    // Advance under the debounce window — no fetch should fire yet.
    await advanceTimers(400);
    await flushMicrotasks();

    // Assert
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refetches with the debounced search term once the debounce window elapses', async () => {
    // Arrange
    render(
      <ProductProvider initialData={initialDataFixture}>
        <CapturingProbe />
      </ProductProvider>
    );

    // Act: type once, then let the debounce fire.
    act(() => {
      refs.setSearchTerm('phone');
    });

    await advanceTimers(500);
    await flushMicrotasks();

    // Assert
    expect(fetchSpy).toHaveBeenCalled();
    expect(lastFetchParam('search')).toBe('phone');
  });

  it('rapid sequential search changes coalesce into a single refetch with the latest term', async () => {
    // Arrange
    render(
      <ProductProvider initialData={initialDataFixture}>
        <CapturingProbe />
      </ProductProvider>
    );

    // Act: type four quick keystrokes within a single debounce window.
    act(() => {
      refs.setSearchTerm('p');
    });
    await advanceTimers(100);
    act(() => {
      refs.setSearchTerm('ph');
    });
    await advanceTimers(100);
    act(() => {
      refs.setSearchTerm('pho');
    });
    await advanceTimers(100);
    act(() => {
      refs.setSearchTerm('phone');
    });

    // Now let the final debounce elapse.
    await advanceTimers(500);
    await flushMicrotasks();

    // Assert: only one fetch fired, and it used the latest term.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(lastFetchParam('search')).toBe('phone');
  });

  it('flushes the live search term when a non-search filter changes mid-typing (regression)', async () => {
    // Arrange: this is the regression test for the P1 bug where filter changes
    // sent the stale debounced search term to the API.
    render(
      <ProductProvider initialData={initialDataFixture}>
        <CapturingProbe />
      </ProductProvider>
    );

    // Act: user types but does NOT wait for the debounce to elapse.
    act(() => {
      refs.setSearchTerm('phone');
    });
    await advanceTimers(100); // well under the 500ms debounce window

    // While still mid-debounce, the user changes a filter.
    act(() => {
      refs.setStatusFilter('active');
    });
    await flushMicrotasks();

    // Assert: the refetch fired immediately (not after the debounce) AND used
    // the live search term, not an empty/stale value.
    expect(fetchSpy).toHaveBeenCalled();
    expect(lastFetchParam('search')).toBe('phone');
    expect(lastFetchParam('status')).toBe('active');

    // And critically: advancing past the original debounce window must NOT
    // produce a second, redundant fetch with the same params (which would
    // also race against the in-hook 1s throttle).
    const callsAfterFlush = fetchSpy.mock.calls.length;
    await advanceTimers(600);
    await flushMicrotasks();
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFlush);
  });
});
