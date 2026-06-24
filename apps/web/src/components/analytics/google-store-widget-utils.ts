import type { MerchantData } from '@/hooks/merchant/types';

export const GOOGLE_MERCHANT_CENTER_ID_CUSTOM_SETTING = 'google_merchant_id';

const MERCHANT_WIDGET_IFRAME_ID = 'merchantwidgetiframe';

/**
 * Finds the Google merchant store-rating iframe that the widget script injects
 * outside React (by id, or by its merchantverse src as a fallback).
 */
function resolveMerchantWidgetFrame(): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const byId = document.getElementById(MERCHANT_WIDGET_IFRAME_ID);
  if (byId) return byId;

  return document.querySelector<HTMLElement>(
    'iframe[src*="google.com/shopping/merchantverse"], iframe[src*="googleusercontent.com/shopping/merchantverse"]'
  );
}

/**
 * Hides or restores the already-injected merchant widget badge. The widget
 * script inserts a fixed iframe outside React, so unmounting the wrapper does
 * NOT remove it — on suppressed (checkout/payment) routes we must hide the
 * existing frame too, not just stop mounting new ones. Toggling `display` is
 * reversible (restored when navigating back to a browse/PDP route) and a no-op
 * when the frame hasn't been injected yet.
 */
export function setMerchantWidgetFrameHidden(hidden: boolean): void {
  const frame = resolveMerchantWidgetFrame();
  if (!frame) return;

  frame.style.display = hidden ? 'none' : '';
}
const GOOGLE_STORE_WIDGET_ENABLED_CUSTOM_SETTING =
  'google_store_widget_enabled';

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

export function getRecordValue(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  return value as Record<string, unknown>;
}

export function normalizeGoogleMerchantCenterId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return String(value);
  }

  if (typeof value !== 'string') return null;

  const trimmedValue = value.trim();

  return /^\d+$/.test(trimmedValue) ? trimmedValue : null;
}

export function resolveGoogleMerchantCenterId(
  merchant?: Pick<MerchantData, 'feature_settings'>
): string | null {
  const featureSettings = getRecordValue(merchant?.feature_settings);
  const customSettings = getRecordValue(featureSettings?.custom_settings);

  return normalizeGoogleMerchantCenterId(
    customSettings?.[GOOGLE_MERCHANT_CENTER_ID_CUSTOM_SETTING]
  );
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

  const featureSettings = getRecordValue(merchant?.feature_settings);
  const customSettings = getRecordValue(featureSettings?.custom_settings);
  const customPreference =
    customSettings?.[GOOGLE_STORE_WIDGET_ENABLED_CUSTOM_SETTING];

  return typeof customPreference === 'boolean' ? customPreference : undefined;
}
