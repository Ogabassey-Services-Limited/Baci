import { describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import { useProductGridPagination } from './use-product-grid-pagination';

interface PaginationResult {
  visibleCount: number;
  visibleProducts: Array<{ id: string }>;
}

interface LoadMoreSignalProps {
  loadMoreSignal: number;
}

interface QueuedSignalProps {
  isLoadingMore: boolean;
  loadMoreSignal: number;
  orderedProducts: Array<{ id: string }>;
}

describe('useProductGridPagination', () => {
  it('reveals more buffered products when the signal advances', () => {
    const loadMore = jest.fn();
    const products = [{ id: '1' }, { id: '2' }];
    const { result, rerender } = renderHook<
      PaginationResult,
      LoadMoreSignalProps
    >(
      ({ loadMoreSignal }) =>
        useProductGridPagination({
          displayLimit: 1,
          hasMore: true,
          isLoadingMore: false,
          loadMore,
          loadMoreSignal,
          orderedProducts: products,
          paginationResetKey: 'base',
        }),
      {
        initialProps: { loadMoreSignal: 0 },
      }
    );

    expect(result.current.visibleProducts).toEqual([{ id: '1' }]);

    rerender({ loadMoreSignal: 1 });

    expect(result.current.visibleProducts).toEqual(products);
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('requests another page when the signal exceeds the buffered products', () => {
    const loadMore = jest.fn();
    const { result, rerender } = renderHook<
      PaginationResult,
      LoadMoreSignalProps
    >(
      ({ loadMoreSignal }) =>
        useProductGridPagination({
          displayLimit: 1,
          hasMore: true,
          isLoadingMore: false,
          loadMore,
          loadMoreSignal,
          orderedProducts: [{ id: '1' }],
          paginationResetKey: 'base',
        }),
      {
        initialProps: { loadMoreSignal: 0 },
      }
    );

    rerender({ loadMoreSignal: 1 });

    expect(result.current.visibleCount).toBe(2);
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('processes queued signals after an in-flight load finishes', () => {
    const loadMore = jest.fn();
    const { result, rerender } = renderHook<
      PaginationResult,
      QueuedSignalProps
    >(
      ({ isLoadingMore, loadMoreSignal, orderedProducts }) =>
        useProductGridPagination({
          displayLimit: 1,
          hasMore: true,
          isLoadingMore,
          loadMore,
          loadMoreSignal,
          orderedProducts,
          paginationResetKey: 'base',
        }),
      {
        initialProps: {
          isLoadingMore: true,
          loadMoreSignal: 0,
          orderedProducts: [{ id: '1' }],
        },
      }
    );

    rerender({
      isLoadingMore: true,
      loadMoreSignal: 2,
      orderedProducts: [{ id: '1' }],
    });

    rerender({
      isLoadingMore: false,
      loadMoreSignal: 2,
      orderedProducts: [{ id: '1' }, { id: '2' }],
    });

    expect(result.current.visibleCount).toBe(3);
    expect(loadMore).toHaveBeenCalledTimes(2);
  });
});
