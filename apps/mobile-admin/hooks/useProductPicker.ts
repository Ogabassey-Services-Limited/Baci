import { useDebounce } from '@/hooks/useDebounce';
import { useProducts } from '@/hooks/useProducts';

function dedupeProductsById<T extends { id: string }>(products: T[]): T[] {
  const seenProductIds = new Set<string>();

  return products.filter((product) => {
    if (seenProductIds.has(product.id)) {
      return false;
    }

    seenProductIds.add(product.id);
    return true;
  });
}

function sortProductsByName<T extends { name?: string | null }>(
  products: T[]
): T[] {
  return [...products].sort((left, right) =>
    (left.name ?? '').localeCompare(right.name ?? '', undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  );
}

export function useProductPicker(searchQuery: string) {
  const debouncedSearchQuery = useDebounce(searchQuery, 150);
  const query = useProducts({
    search: debouncedSearchQuery.trim() || undefined,
  });
  const products = query.data?.pages.flatMap((page) => page.products) ?? [];

  return {
    ...query,
    products: sortProductsByName(dedupeProductsById(products)),
  };
}
