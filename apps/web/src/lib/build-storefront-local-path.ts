import type { Route } from 'next';
import type { headers } from 'next/headers';
import { isDomainIdentifier } from '@/lib/validation';

export function buildStorefrontLocalPath(
  headersList: Awaited<ReturnType<typeof headers>>,
  routeIdentifier: string,
  pathname: `/${string}`
): Route {
  const prefix =
    headersList.has('x-custom-domain') ||
    headersList.has('x-merchant-slug') ||
    isDomainIdentifier(routeIdentifier)
      ? ''
      : `/${routeIdentifier}`;

  return `${prefix}${pathname}` as Route;
}
