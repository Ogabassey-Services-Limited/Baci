import { useEffect, useRef, useState } from 'react';

type LoadMoreFn = () => unknown;

interface BackfillRequest {
  productCount: number;
  visibleCount: number;
}

interface UseProductGridPaginationOptions<TProduct> {
  displayLimit: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: LoadMoreFn;
  loadMoreSignal: number;
  orderedProducts: TProduct[];
  paginationResetKey: string;
}

export function useProductGridPagination<TProduct>({
  displayLimit,
  hasMore,
  isLoadingMore,
  loadMore,
  loadMoreSignal,
  orderedProducts,
  paginationResetKey,
}: UseProductGridPaginationOptions<TProduct>) {
  const [visibleCount, setVisibleCount] = useState(displayLimit);
  const lastHandledLoadMoreSignalRef = useRef(0);
  const lastPaginationResetKeyRef = useRef('');
  const pendingLoadMoreSignalRef = useRef<number | null>(null);
  const lastBackfillRequestRef = useRef<BackfillRequest | null>(null);

  useEffect(() => {
    if (lastPaginationResetKeyRef.current === paginationResetKey) {
      return;
    }

    lastPaginationResetKeyRef.current = paginationResetKey;
    setVisibleCount(displayLimit);
    lastHandledLoadMoreSignalRef.current = loadMoreSignal;
    pendingLoadMoreSignalRef.current = null;
    lastBackfillRequestRef.current = null;
  }, [displayLimit, loadMoreSignal, paginationResetKey]);

  useEffect(() => {
    const nextSignal = Math.max(
      pendingLoadMoreSignalRef.current ?? 0,
      loadMoreSignal
    );

    if (nextSignal <= 0 || nextSignal <= lastHandledLoadMoreSignalRef.current) {
      return;
    }

    if (isLoadingMore) {
      pendingLoadMoreSignalRef.current = nextSignal;
      return;
    }

    pendingLoadMoreSignalRef.current = null;
    const signalDelta = nextSignal - lastHandledLoadMoreSignalRef.current;
    const nextVisibleCount = visibleCount + signalDelta * displayLimit;
    setVisibleCount(nextVisibleCount);
    lastHandledLoadMoreSignalRef.current = nextSignal;

    if (orderedProducts.length < nextVisibleCount && hasMore) {
      lastBackfillRequestRef.current = {
        productCount: orderedProducts.length,
        visibleCount: nextVisibleCount,
      };
      void loadMore();
    }
  }, [
    displayLimit,
    hasMore,
    isLoadingMore,
    loadMore,
    loadMoreSignal,
    orderedProducts.length,
    visibleCount,
  ]);

  useEffect(() => {
    const shouldResetBackfillRequest =
      visibleCount <= displayLimit || orderedProducts.length >= visibleCount;

    if (shouldResetBackfillRequest) {
      lastBackfillRequestRef.current = null;
    }

    if (
      visibleCount <= displayLimit ||
      orderedProducts.length >= visibleCount ||
      !hasMore ||
      isLoadingMore
    ) {
      return;
    }

    const isDuplicateBackfillRequest =
      lastBackfillRequestRef.current?.productCount === orderedProducts.length &&
      lastBackfillRequestRef.current?.visibleCount === visibleCount;

    if (isDuplicateBackfillRequest) {
      return;
    }

    lastBackfillRequestRef.current = {
      productCount: orderedProducts.length,
      visibleCount,
    };
    void loadMore();
  }, [
    displayLimit,
    hasMore,
    isLoadingMore,
    loadMore,
    orderedProducts.length,
    visibleCount,
  ]);

  return {
    visibleCount,
    visibleProducts: orderedProducts.slice(0, visibleCount),
  };
}
