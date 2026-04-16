import { jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import type { ProductGridBlock } from '@/types/blocks';
import {
  block,
  extendedSampleProducts,
  mockProductsHook,
  mockUseProductsFactory,
  ProductGrid,
  resetProductGridTestState,
  sampleProducts,
  type UseProductsResult,
} from './ProductGrid.test-utils';

describe('ProductGrid pagination', () => {
  beforeEach(() => {
    resetProductGridTestState();
  });

  it('reveals more buffered products when the home scroll requests more items', () => {
    const loadMore = jest.fn();
    const incrementalBlock: ProductGridBlock = {
      ...block,
      props: {
        ...block.props,
        limit: 1,
      },
    };

    mockProductsHook({
      products: sampleProducts,
      hasMore: true,
      loadMore,
    });

    const { rerender } = render(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={0}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    expect(screen.queryByText('Pixel 8')).toBeNull();

    rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={1}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    expect(screen.getByText('Pixel 8')).toBeTruthy();
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('fetches another page when the home scroll requests more items than are buffered', () => {
    const loadMore = jest.fn();
    const incrementalBlock: ProductGridBlock = {
      ...block,
      props: {
        ...block.props,
        limit: 1,
      },
    };

    mockProductsHook({
      products: [sampleProducts[0]],
      hasMore: true,
      loadMore,
    });

    const { rerender } = render(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={0}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={1}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('does not replay a stale load-more signal after pagination resets', async () => {
    const incrementalBlock: ProductGridBlock = {
      ...block,
      props: {
        ...block.props,
        limit: 1,
      },
    };

    const view = render(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={0}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    expect(screen.getByText('iPhone 13 Pro')).toBeTruthy();
    expect(screen.queryByText('Pixel 8')).toBeNull();

    view.rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={1}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Pixel 8')).toBeTruthy();
    });

    view.rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={1}
        selectedCategoryId="cat-phones"
        variant="grid"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('iPhone 13 Pro')).toBeTruthy();
      expect(screen.queryByText('Pixel 8')).toBeNull();
    });
  });

  it('processes queued load-more signals after an in-flight page finishes', async () => {
    const incrementalBlock: ProductGridBlock = {
      ...block,
      props: {
        ...block.props,
        limit: 1,
      },
    };
    const loadMore = jest.fn();
    let productsResult: UseProductsResult = {
      products: [sampleProducts[0]],
      total: 1,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      hasMore: true,
      refetch: jest.fn(),
      loadMore,
      isLoadingMore: true,
    };
    mockUseProductsFactory.mockImplementation(() => productsResult);

    const view = render(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={0}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    view.rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={1}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    view.rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={2}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    productsResult = {
      ...productsResult,
      products: sampleProducts,
      total: sampleProducts.length,
      isLoadingMore: false,
    };

    view.rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={2}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    await waitFor(() => {
      expect(loadMore).toHaveBeenCalledTimes(2);
    });
  });

  it('keeps backfilling when a batched signal jump requests multiple pages', async () => {
    const loadMore = jest.fn();
    const incrementalBlock: ProductGridBlock = {
      ...block,
      props: {
        ...block.props,
        limit: 1,
      },
    };
    let productsResult: UseProductsResult = {
      products: [extendedSampleProducts[0]],
      total: 1,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      hasMore: true,
      refetch: jest.fn(),
      loadMore,
      isLoadingMore: false,
    };
    mockUseProductsFactory.mockImplementation(() => productsResult);

    const view = render(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={0}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    view.rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={2}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    expect(loadMore).toHaveBeenCalledTimes(1);

    productsResult = {
      ...productsResult,
      products: extendedSampleProducts.slice(0, 2),
    };

    view.rerender(
      <ProductGrid
        block={incrementalBlock}
        loadMoreSignal={2}
        selectedCategoryId={null}
        variant="grid"
      />
    );

    await waitFor(() => {
      expect(loadMore).toHaveBeenCalledTimes(2);
    });
  });
});
