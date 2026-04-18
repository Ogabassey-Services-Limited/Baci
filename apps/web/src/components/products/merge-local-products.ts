import type { Product } from '@/lib/products';

interface MergeLocalProductsOptions {
  current: Product[];
  dirtyProductIds: Set<string>;
  incoming: Product[];
}

export function mergeLocalProducts({
  current,
  dirtyProductIds,
  incoming,
}: MergeLocalProductsOptions): Product[] {
  const currentById = new Map(current.map((product) => [product.id, product]));

  return incoming.map((product) =>
    dirtyProductIds.has(product.id)
      ? (currentById.get(product.id) ?? product)
      : product
  );
}
