import { useEffect, useState } from 'react';
import type { Product } from '../types';

interface UseHomePreviewCatalogOptions {
  products?: Product[];
  loadPreviewCatalog?: () => Promise<{ products: Product[] }>;
}

// The mock catalog only backs the template preview (no merchant products yet),
// so it must never be eagerly bundled into real storefront home payloads.
const loadDefaultPreviewCatalogModule = () => import('../data/products');

/**
 * Single source of truth for "this store has its own products" — shared by the
 * hook and HomeProductGrid so the preview-catalog gate can't drift between the
 * two call sites.
 */
export function hasRealProducts(products?: Product[]): products is Product[] {
  return Boolean(products && products.length > 0);
}

/**
 * Lazily loads the mock preview catalog for storefront homes that have no
 * merchant products yet. When real products are provided the import is
 * skipped entirely, and a failed import is swallowed so the grid keeps
 * rendering its empty shell.
 */
export function useHomePreviewCatalog({
  products,
  loadPreviewCatalog,
}: UseHomePreviewCatalogOptions): Product[] | null {
  const [previewCatalog, setPreviewCatalog] = useState<Product[] | null>(null);
  const storeHasProducts = hasRealProducts(products);

  useEffect(() => {
    if (storeHasProducts || previewCatalog) {
      return;
    }

    let cancelled = false;
    void (loadPreviewCatalog ?? loadDefaultPreviewCatalogModule)()
      .then((previewCatalogModule) => {
        if (!cancelled) {
          setPreviewCatalog(previewCatalogModule.products);
        }
      })
      .catch(() => {
        // Preview catalog is a best-effort template fallback; keep the empty
        // shell rendered if the module fails to load.
      });

    return () => {
      cancelled = true;
    };
  }, [storeHasProducts, loadPreviewCatalog, previewCatalog]);

  return previewCatalog;
}
