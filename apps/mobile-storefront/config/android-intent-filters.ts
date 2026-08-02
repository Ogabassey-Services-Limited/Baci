import type { ExpoConfig } from 'expo/config';

type AndroidIntentFilters = NonNullable<
  NonNullable<ExpoConfig['android']>['intentFilters']
>;

const STOREFRONT_HOSTS = ['ogabassey.com', 'ogabassey.usebaci.com'] as const;

const STOREFRONT_NATIVE_PATHS = [
  { pathPrefix: '/product/' },
  { pathPrefix: '/category/' },
  { path: '/receipts' },
  { pathPrefix: '/receipts/claim/' },
  { path: '/account' },
  { pathPrefix: '/account/' },
  { path: '/cart' },
  { path: '/' },
] as const;

export function buildStorefrontAndroidIntentFilters(): AndroidIntentFilters {
  return STOREFRONT_HOSTS.map((host) => ({
    action: 'VIEW',
    autoVerify: true,
    data: STOREFRONT_NATIVE_PATHS.map((path) => ({
      scheme: 'https',
      host,
      ...path,
    })),
    category: ['BROWSABLE', 'DEFAULT'],
  }));
}
