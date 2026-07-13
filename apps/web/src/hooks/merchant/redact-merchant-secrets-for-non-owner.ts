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
  // owner identity / registration + KYC state — no non-owner staff need
  'legal_entity_name',
  'registered_address',
  'tax_identification_number',
  'cac_rc_number',
  'kyc_status',
] as const satisfies readonly (keyof MerchantData)[];

/**
 * Secret keys inside the embedded `feature_settings:merchant_feature_settings(*)`
 * projection. The dashboard select pulls the whole feature-settings row, which
 * carries its OWN marketing/payment credentials in addition to the boolean
 * feature flags staff legitimately need — so these keys must be scrubbed while
 * the flags are preserved.
 */
export const NON_OWNER_REDACTED_FEATURE_SETTINGS_KEYS = [
  'facebook_capi_token',
  'ga4_api_secret',
  'tiktok_access_token',
  'snapchat_capi_token',
  'credit_direct_public_key',
] as const;

/**
 * Returns a copy of the merchant with all owner-only secret fields stripped —
 * both top-level columns and the nested feature-settings credentials. Call for
 * any non-owner (staff) dashboard context before serializing it to a client or
 * Server Component.
 */
export function redactMerchantSecretsForNonOwner(
  merchant: MerchantData
): MerchantData {
  const redacted = { ...merchant };
  for (const field of NON_OWNER_REDACTED_FIELDS) {
    redacted[field] = undefined;
  }

  if (redacted.feature_settings) {
    const featureSettings = { ...redacted.feature_settings };
    for (const key of NON_OWNER_REDACTED_FEATURE_SETTINGS_KEYS) {
      featureSettings[key] = undefined;
    }
    redacted.feature_settings = featureSettings;
  }

  return redacted;
}
