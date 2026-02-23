'use client';

import { usePathname } from 'next/navigation';

const KNOWN_ROUTES = [
  'account',
  'cart',
  'checkout',
  'products',
  'wishlist',
  'wallet',
  'repairs',
  'imei-check',
  'pages',
  'orders',
];

/**
 * Hook to extract the store slug from the current pathname.
 * Returns empty string if the first segment is a known route.
 */
export function useStoreSlug(): string {
  const pathname = usePathname();
  const pathSegments = pathname?.split('/').filter(Boolean) || [];
  const firstSegment = pathSegments[0] || '';
  return KNOWN_ROUTES.includes(firstSegment) ? '' : firstSegment;
}
