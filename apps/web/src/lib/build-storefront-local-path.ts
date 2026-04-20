import type { headers } from 'next/headers';
import { isDomainIdentifier } from './validation';

export function buildStorefrontLocalPath(
  headersList: Awaited<ReturnType<typeof headers>>,
  routeIdentifier: string,
  pathname: `/${string}`
) {
  const prefix =
    headersList.has('x-custom-domain') ||
    headersList.has('x-merchant-slug') ||
    isDomainIdentifier(routeIdentifier)
      ? ''
      : `/${routeIdentifier}`;

  return `${prefix}${pathname}`;
}
