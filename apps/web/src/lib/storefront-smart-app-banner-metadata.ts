import type { Metadata } from 'next';
import { resolveStorefrontAppearance } from '@/components/storefront/storefront-appearance';
import { OGABASSEY_STOREFRONT_IOS_APP_ID } from '@/config/platform';

type MetadataOther = NonNullable<Metadata['other']>;

const APPLE_ITUNES_APP_METADATA_KEY = 'apple-itunes-app';

export function mergeStorefrontSmartAppBannerOther(
  identifier: string | null | undefined,
  other?: MetadataOther
): MetadataOther | undefined {
  if (resolveStorefrontAppearance(identifier).variant !== 'ogabassey') {
    return other;
  }

  return {
    ...other,
    [APPLE_ITUNES_APP_METADATA_KEY]: `app-id=${OGABASSEY_STOREFRONT_IOS_APP_ID}`,
  };
}
