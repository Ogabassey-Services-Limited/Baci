import type { MerchantData } from '@/hooks/use-merchant';

/**
 * Strips protocol, pathname, and leading `www.` from a hostname or URL string
 * so that domains can be compared in a canonical form.
 */
export function normalizeHostname(value?: string) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
}

/**
 * Resolves the merchant's preference for the Google Store Widget.
 *
 * Checks `feature_settings.google_store_widget_enabled` first, then falls back
 * to `feature_settings.custom_settings.google_store_widget_enabled`.
 * Returns `undefined` when neither is configured.
 */
export function resolveGoogleStoreWidgetPreference(
  merchant?: MerchantData
): boolean | undefined {
  const directPreference =
    merchant?.feature_settings?.google_store_widget_enabled;

  if (typeof directPreference === 'boolean') {
    return directPreference;
  }

  // MerchantData.feature_settings carries loose keys, so we cast to inspect
  // nested custom_settings here and still rely on runtime typeof checks below.
  const featureSettings = merchant?.feature_settings as
    | Record<string, unknown>
    | undefined;
  const customSettings = featureSettings?.custom_settings as
    | Record<string, unknown>
    | undefined;
  const customPreference = customSettings?.google_store_widget_enabled;

  return typeof customPreference === 'boolean' ? customPreference : undefined;
}
