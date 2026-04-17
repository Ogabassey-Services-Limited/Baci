import type { Product } from '@/lib/products';

interface SaveDirtyProductsOptions {
  dirtyProductIds: Iterable<string>;
  localProducts: Product[];
  updateProduct: (product: Product) => Promise<unknown>;
}

export interface SaveDirtyProductsResult {
  failedIds: string[];
  fulfilledIds: string[];
  skippedIds: string[];
}

export async function saveDirtyProducts({
  dirtyProductIds,
  localProducts,
  updateProduct,
}: SaveDirtyProductsOptions): Promise<SaveDirtyProductsResult> {
  const dirtyIds = Array.from(dirtyProductIds);
  const productsById = new Map(
    localProducts.map((product) => [product.id, product])
  );
  const settled = await Promise.allSettled(
    dirtyIds.map(async (id) => {
      const product = productsById.get(id);

      if (!product) {
        return { id, outcome: 'skipped' as const };
      }

      await updateProduct(product);
      return { id, outcome: 'fulfilled' as const };
    })
  );

  const result: SaveDirtyProductsResult = {
    failedIds: [],
    fulfilledIds: [],
    skippedIds: [],
  };

  for (let index = 0; index < settled.length; index += 1) {
    const dirtyId = dirtyIds[index];
    const entry = settled[index];

    if (entry.status === 'rejected') {
      result.failedIds.push(dirtyId);
      continue;
    }

    if (entry.value.outcome === 'fulfilled') {
      result.fulfilledIds.push(entry.value.id);
      continue;
    }

    result.skippedIds.push(entry.value.id);
  }

  return result;
}
