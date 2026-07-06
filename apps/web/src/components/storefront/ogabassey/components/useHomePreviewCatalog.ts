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
  const hasRealProducts = Boolean(products && products.length > 0);

  useEffect(() => {
    if (hasRealProducts || previewCatalog) {
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
  }, [hasRealProducts, loadPreviewCatalog, previewCatalog]);

  return previewCatalog;
}
