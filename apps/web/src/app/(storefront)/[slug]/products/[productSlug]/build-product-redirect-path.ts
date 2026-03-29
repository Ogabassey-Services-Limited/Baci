import type { Route } from 'next';

export function buildProductRedirectPath(
  storeSlug: string,
  productPath: string
): Route {
  const normalizedProductPath = `/${productPath.replace(/^\/+/, '')}`;
  return (
    process.env.NODE_ENV === 'development'
      ? `/${storeSlug}${normalizedProductPath}`
      : normalizedProductPath
  ) as Route;
}
