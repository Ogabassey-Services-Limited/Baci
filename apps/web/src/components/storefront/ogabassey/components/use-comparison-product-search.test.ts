import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import type { SearchResultProduct } from './comparison-search-types';

const mockFetchComparisonProductSearchResults = vi.hoisted(() => vi.fn());

vi.mock('./comparison-product-search', () => ({
  fetchComparisonProductSearchResults: mockFetchComparisonProductSearchResults,
}));

import { useComparisonProductSearch } from './use-comparison-product-search';

function createMainProduct(): Product {
  return {
    id: 'main-product',
    merchantId: 'merchant-1',
    name: 'Samsung Galaxy Z TriFold',
    price: '₦7,150,000',
    image: 'https://example.com/main.jpg',
    description: 'Flagship foldable',
    category: 'Smartphones',
    categorySlug: 'smartphones',
  };
}

function createSearchResult(): SearchResultProduct {
  return {
    id: 'ipad-pro',
    name: 'iPad Pro',
    slug: 'ipad-pro',
    price: 1500,
    image: 'https://example.com/ipad.jpg',
    category: 'Smartphones',
    condition: 'new',
  };
}

function renderSearchHook() {
  return renderHook(() =>
    useComparisonProductSearch({
      mainProduct: createMainProduct(),
      comparisonProducts: [],
    })
  );
}

describe('useComparisonProductSearch', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not search when the query is shorter than 2 characters', async () => {
    const { result } = renderSearchHook();

    act(() => {
      result.current.handleQueryChange('a');
    });

    expect(result.current.query).toBe('a');
    expect(result.current.loading).toBe(false);
    expect(result.current.results).toEqual([]);
    expect(result.current.searchError).toBeNull();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(mockFetchComparisonProductSearchResults).not.toHaveBeenCalled();
  });

  it('debounces the query and stores the search results', async () => {
    mockFetchComparisonProductSearchResults.mockResolvedValue([
      createSearchResult(),
    ]);
    const { result } = renderSearchHook();

    act(() => {
      result.current.handleQueryChange('ipad');
    });

    await waitFor(() =>
      expect(mockFetchComparisonProductSearchResults).toHaveBeenCalledTimes(1)
    );
    expect(mockFetchComparisonProductSearchResults).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'ipad',
        signal: expect.any(AbortSignal),
      })
    );

    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(result.current.results[0]?.name).toBe('iPad Pro');
    expect(result.current.loading).toBe(false);
    expect(result.current.searchError).toBeNull();
  });

  it('surfaces a user-visible error when the search fails', async () => {
    mockFetchComparisonProductSearchResults.mockRejectedValue(
      new Error('Network down')
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { result } = renderSearchHook();

    act(() => {
      result.current.handleQueryChange('ipad');
    });

    await waitFor(() =>
      expect(result.current.searchError).toBe(
        'Could not load products. Try again.'
      )
    );
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  it('clears stale results when the query becomes too short', async () => {
    mockFetchComparisonProductSearchResults.mockResolvedValue([
      createSearchResult(),
    ]);
    const { result } = renderSearchHook();

    act(() => {
      result.current.handleQueryChange('ipad');
    });
    await waitFor(() => expect(result.current.results).toHaveLength(1));

    act(() => {
      result.current.handleQueryChange('i');
    });

    expect(result.current.query).toBe('i');
    expect(result.current.results).toEqual([]);
    expect(result.current.searchError).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('resets the query, results, error, and loading state on resetSearch', async () => {
    mockFetchComparisonProductSearchResults.mockResolvedValue([
      createSearchResult(),
    ]);
    const { result } = renderSearchHook();

    act(() => {
      result.current.handleQueryChange('ipad');
    });
    await waitFor(() => expect(result.current.results).toHaveLength(1));

    act(() => {
      result.current.resetSearch();
    });

    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.searchError).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('clears only the search error on clearSearchError', async () => {
    mockFetchComparisonProductSearchResults.mockResolvedValue([
      createSearchResult(),
    ]);
    const { result } = renderSearchHook();

    act(() => {
      result.current.handleQueryChange('ipad');
    });
    await waitFor(() => expect(result.current.results).toHaveLength(1));

    act(() => {
      result.current.clearSearchError();
    });

    expect(result.current.searchError).toBeNull();
    expect(result.current.results).toHaveLength(1);
    expect(result.current.query).toBe('ipad');
  });
});
