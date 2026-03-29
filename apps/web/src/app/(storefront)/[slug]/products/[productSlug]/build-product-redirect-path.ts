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
  // Force request-scoped execution when callers pass next/headers.
  await getHeaders();
  const normalizedProductPath = productPath.startsWith('/')
    ? productPath
    : `/${productPath}`;

  return (
    process.env.NODE_ENV === 'development'
      ? `/${storeSlug}${normalizedProductPath}`
      : normalizedProductPath
  ) as Route;
}
