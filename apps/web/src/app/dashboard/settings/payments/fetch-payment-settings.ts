import {
  normalizePaymentSettings,
  type PaymentGatewaySettings,
} from './payment-settings';

/**
 * Load the merchant's payment settings from `/api/merchant/features` and
 * normalize the payload (Korapay defaults OFF on a null/absent flag). Returns
 * `null` on a non-OK response so the caller can surface a load error.
 */
export async function fetchPaymentSettings(
  merchantId?: string
): Promise<PaymentGatewaySettings | null> {
  const query = merchantId
    ? `?${new URLSearchParams({ merchantId }).toString()}`
    : '';
  const response = await fetch(`/api/merchant/features${query}`);
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return normalizePaymentSettings(data);
}
