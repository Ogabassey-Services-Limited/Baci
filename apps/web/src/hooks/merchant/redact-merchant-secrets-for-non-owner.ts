import type { MerchantData } from './types';

/**
 * Owner-only secret columns on `merchants`. A non-owner staff member — even an
 * active one — must never receive these, regardless of role. The dashboard
 * merchant context is resolved under the service role (which bypasses RLS), so
 * this redaction is the boundary that keeps low-privilege staff (e.g.
 * fulfillment, sales) from reading the owner's identity/financial/marketing
 * credentials. Payout/KYC surfaces that a permitted staffer legitimately needs
 * must fetch through their own permission-scoped endpoints, not this context.
 */
export const NON_OWNER_REDACTED_FIELDS = [
  'nin',
  'bvn',
  'bank_account_number',
  'bank_account_name',
  'bank_code',
  'bank_name',
  'paystack_subaccount_code',
  'stripe_customer_id',
  'stripe_subscription_id',
  'facebook_capi_token',
  'ga4_api_secret',
  'tiktok_access_token',
  'snapchat_capi_token',
  'virtual_terminal_code',
] as const satisfies readonly (keyof MerchantData)[];

/**
 * Returns a copy of the merchant with all owner-only secret fields stripped.
 * Call for any non-owner (staff) dashboard context before serializing it to a
 * client or Server Component.
 */
export function redactMerchantSecretsForNonOwner(
  merchant: MerchantData
): MerchantData {
  const redacted = { ...merchant };
  for (const field of NON_OWNER_REDACTED_FIELDS) {
    redacted[field] = undefined;
  }
  return redacted;
}
