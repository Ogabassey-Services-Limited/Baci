import { useDebounce } from '@/hooks/useDebounce';
import { useProducts } from '@/hooks/useProducts';

export function useProductPicker(searchQuery: string) {
  const debouncedSearchQuery = useDebounce(searchQuery, 150);
  const query = useProducts({
    search: debouncedSearchQuery.trim() || undefined,
  });

  return {
    ...query,
    products: query.data?.pages.flatMap((page) => page.products) ?? [],
  };
}
