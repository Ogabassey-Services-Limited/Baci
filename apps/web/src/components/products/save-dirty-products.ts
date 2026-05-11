import type { Product } from '@/lib/products';

interface SaveDirtyProductsOptions {
  dirtyProductIds: Iterable<string>;
  dirtyProductSnapshots?: ReadonlyMap<string, Product>;
  localProducts: Product[];
  signal?: AbortSignal;
  updateProduct: (product: Product) => Promise<unknown>;
}

export interface SaveDirtyProductsResult {
  failedIds: string[];
  fulfilledIds: string[];
  skippedIds: string[];
}

const emptyResult = (): SaveDirtyProductsResult => ({
  failedIds: [],
  fulfilledIds: [],
  skippedIds: [],
});

export async function saveDirtyProducts({
  dirtyProductIds,
  dirtyProductSnapshots,
  localProducts,
  signal,
  updateProduct,
}: SaveDirtyProductsOptions): Promise<SaveDirtyProductsResult> {
  if (signal?.aborted) {
    return emptyResult();
  }

  const dirtyIds = Array.from(dirtyProductIds);
  const productsById = new Map(
    localProducts.map((product) => [product.id, product])
  );
  const settled = await Promise.allSettled(
    dirtyIds.map(async (id) => {
      const product = productsById.get(id) ?? dirtyProductSnapshots?.get(id);

      if (!product) {
        return { id, outcome: 'skipped' as const };
      }

      // Best-effort cancellation: skip dispatching the network call if the
      // signal has aborted by the time this entry runs. Individual
      // updateProduct calls already in flight cannot be cancelled from here
      // without changing the updateProduct signature.
      if (signal?.aborted) {
        return { id, outcome: 'skipped' as const };
      }

      await updateProduct(product);
      return { id, outcome: 'fulfilled' as const };
    })
  );

  if (signal?.aborted) {
    return emptyResult();
  }

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
