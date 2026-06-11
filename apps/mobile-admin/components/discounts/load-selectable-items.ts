import {
  fetchSelectableItems,
  type SelectableItem,
} from '@/lib/discount-items';

interface LoadSelectableItemsParams {
  merchantId: string;
  requestIdRef: { current: number };
  search: string;
  setFetchError: (error: string | null) => void;
  setItems: (items: SelectableItem[]) => void;
  setLoading: (loading: boolean) => void;
  type: 'product' | 'category';
}

// Module-scope so the try/finally stays outside the component body
// (React Compiler cannot lower try/finally yet).
export async function loadSelectableItems({
  merchantId,
  requestIdRef,
  search,
  setFetchError,
  setItems,
  setLoading,
  type,
}: LoadSelectableItemsParams) {
  const requestId = ++requestIdRef.current;
  setLoading(true);
  setFetchError(null);
  try {
    const fetchedItems = await fetchSelectableItems({
      merchantId,
      type,
      search,
    });
    if (requestId !== requestIdRef.current) return;
    setItems(fetchedItems);
  } catch (error) {
    console.error('[DiscountItemSelector] Error fetching items:', error);
    if (requestId === requestIdRef.current) {
      setFetchError('Failed to load items');
    }
  } finally {
    if (requestId === requestIdRef.current) {
      setLoading(false);
    }
  }
}
