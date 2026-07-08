import type { PayPalMode } from './paypal-types';

export const PAYPAL_SANDBOX_API_URL = 'https://api-m.sandbox.paypal.com';
export const PAYPAL_LIVE_API_URL = 'https://api-m.paypal.com';

/** Selects the PayPal REST API base URL for the given mode. */
export function getPayPalBaseUrl(mode: PayPalMode): string {
  return mode === 'live' ? PAYPAL_LIVE_API_URL : PAYPAL_SANDBOX_API_URL;
}
