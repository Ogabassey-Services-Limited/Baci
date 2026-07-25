import {
  normalizePaymentSettings,
  type PaymentGatewaySettings,
} from './payment-settings';

/**
 * Load the merchant's payment settings from `/api/merchant/features` and
 * normalize the payload (Korapay defaults OFF on a null/absent flag). Returns
 * `null` on a non-OK response so the caller can surface a load error.
 */
export async function fetchPaymentSettings(): Promise<PaymentGatewaySettings | null> {
  const response = await fetch('/api/merchant/features');
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return normalizePaymentSettings(data);
}
