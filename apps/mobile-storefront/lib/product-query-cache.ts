import type { Product } from '@/types/product';

interface ProductsPageCache {
  products: Product[];
  nextOffset: number | null;
  total: number;
}

interface ProductsInfiniteCache {
  pages: ProductsPageCache[];
  pageParams: unknown[];
}

function isProductCacheEntry(product: unknown): product is Product {
  return (
    !!product &&
    typeof product === 'object' &&
    typeof (product as { slug?: unknown }).slug === 'string'
  );
}

function isProductsPageCache(page: unknown): page is ProductsPageCache {
  const pageRecord = page as {
    products?: unknown;
    nextOffset?: unknown;
    total?: unknown;
  };
  return (
    !!page &&
    typeof page === 'object' &&
    Array.isArray(pageRecord.products) &&
    pageRecord.products.every(isProductCacheEntry) &&
    (typeof pageRecord.nextOffset === 'number' ||
      pageRecord.nextOffset === null) &&
    typeof pageRecord.total === 'number'
  );
}

function isProductsInfiniteCache(
  cache: unknown
): cache is ProductsInfiniteCache {
  return (
    !!cache &&
    typeof cache === 'object' &&
    Array.isArray((cache as ProductsInfiniteCache).pages) &&
    (cache as ProductsInfiniteCache).pages.every(isProductsPageCache) &&
    Array.isArray((cache as ProductsInfiniteCache).pageParams)
  );
}

function summarizeUnexpectedCache(cache: unknown) {
  if (!cache || typeof cache !== 'object') {
    return { type: typeof cache };
  }

  const cacheRecord = cache as {
    pages?: unknown;
    pageParams?: unknown;
  };
  const pages = cacheRecord.pages;
  const firstPage =
    Array.isArray(pages) && pages.length > 0 ? pages[0] : undefined;
  const firstPageProducts = (firstPage as { products?: unknown })?.products;

  return {
    keys: Object.keys(cache),
    pagesIsArray: Array.isArray(pages),
    pageParamsIsArray: Array.isArray(cacheRecord.pageParams),
    firstPageHasProductsArray: Array.isArray(firstPageProducts),
    firstPageProductCount: Array.isArray(firstPageProducts)
      ? firstPageProducts.length
      : null,
  };
}

export function removeProductSlugFromProductsCache(
  cache: unknown,
  slug: string
) {
  if (!isProductsInfiniteCache(cache)) {
    if (cache != null) {
      console.debug(
        '[product-query-cache] Unexpected products cache shape',
        summarizeUnexpectedCache(cache)
      );
    }
    return cache;
  }

  if (!slug) {
    return cache;
  }

  let removedCount = 0;
  const pages = cache.pages.map((page) => {
    const nextProducts = page.products.filter(
      (product) => product.slug !== slug
    );
    removedCount += page.products.length - nextProducts.length;

    if (nextProducts.length === page.products.length) {
      return page;
    }

    return {
      ...page,
      products: nextProducts,
    };
  });

  if (removedCount === 0) {
    return cache;
  }

  return {
    ...cache,
    pages: pages.map((page) => ({
      ...page,
      total: Math.max(page.total - removedCount, 0),
    })),
  };
}
