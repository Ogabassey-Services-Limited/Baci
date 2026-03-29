import type { Route } from 'next';

interface HeaderLookup {
  has(name: string): boolean;
}

type HeadersProvider = () => HeaderLookup | Promise<HeaderLookup>;

export async function buildProductRedirectPath(
  storeSlug: string,
  productPath: string,
  getHeaders: HeadersProvider
): Promise<Route> {
  // Force request-scoped execution so redirects honor the active routing mode.
  await getHeaders();
  return (
    process.env.NODE_ENV === 'development'
      ? `/${storeSlug}${productPath}`
      : productPath
  ) as Route;
}
