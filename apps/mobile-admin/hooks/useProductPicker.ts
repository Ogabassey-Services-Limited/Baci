import { dedupeById } from '@baci/shared';
import { useDebounce } from '@/hooks/useDebounce';
import { useProducts } from '@/hooks/useProducts';

export function useProductPicker(searchQuery: string) {
  const debouncedSearchQuery = useDebounce(searchQuery, 150);
  const trimmedSearchQuery = debouncedSearchQuery.trim();
  const query = useProducts({
    search: trimmedSearchQuery || undefined,
  });
  const products = query.data?.pages.flatMap((page) => page.products) ?? [];

  return {
    ...query,
    // Preserve the server's ordering: relevance from `search_products_v2` while
    // searching, and `created_at` desc while browsing. A client-side sort here
    // would only reorder the already-loaded pages, so the ranking would shuffle
    // as more pages load (`fetchProducts` pages before `.range(...)`).
    products: dedupeById(products),
  };
}
