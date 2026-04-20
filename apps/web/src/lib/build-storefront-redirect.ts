import type { Route } from 'next';
import type { headers } from 'next/headers';
import { buildStorefrontLocalPath } from '@/lib/build-storefront-local-path';

export function buildStorefrontRedirect(
  headersList: Awaited<ReturnType<typeof headers>>,
  slug: string,
  pathname: `/${string}`,
  query: Record<string, string | string[] | undefined>
): Route {
  const basePath = buildStorefrontLocalPath(headersList, slug, pathname);
  const queryString = new URLSearchParams(
    Object.entries(query).flatMap(([k, v]) =>
      Array.isArray(v)
        ? v.map((val) => [k, val])
        : v !== undefined
          ? [[k, v]]
          : []
    )
  ).toString();
  return queryString ? (`${basePath}?${queryString}` as Route) : basePath;
}
