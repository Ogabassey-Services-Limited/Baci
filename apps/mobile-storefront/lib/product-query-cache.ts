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

function isProductsInfiniteCache(
  cache: unknown
): cache is ProductsInfiniteCache {
  return (
    !!cache &&
    typeof cache === 'object' &&
    Array.isArray((cache as ProductsInfiniteCache).pages) &&
    Array.isArray((cache as ProductsInfiniteCache).pageParams)
  );
}

export function removeProductSlugFromProductsCache(
  cache: unknown,
  slug: string
) {
  if (!isProductsInfiniteCache(cache) || !slug) {
    return cache;
  }

  let removedCount = 0;
  const pages = cache.pages.map((page) => {
    const nextProducts = page.products.filter((product) => product.slug !== slug);
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
