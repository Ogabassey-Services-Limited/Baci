import type { ExpoConfig } from 'expo/config';

type AndroidIntentFilters = NonNullable<
  NonNullable<ExpoConfig['android']>['intentFilters']
>;

export function buildStorefrontAndroidIntentFilters(): AndroidIntentFilters;
