import type { MerchantData } from './types';

/**
 * Top-level `merchants` secret columns that have NO client `useMerchant()`
 * consumer, so they can be blanket-stripped for a non-owner staff member with
 * zero page-break risk. This is the safe, non-permission-scoped subset of the
 * full staff redaction — it closes the sharpest exposure (national identifiers,
 * billing IDs, terminal + top-level marketing credentials) while the
 * permission-scoped fields (bank/paystack/product-sheet and the nested
 * feature_settings bags) are handled by the S1 bounded-projection follow-up.
 *
 * Verified non-consuming:
 *  - bvn/nin: only the owner-gated KYC page reads them, via the owner branch;
 *  - stripe_*: no client reader;
 *  - virtual_terminal_code: read only by dedicated VT routes, not this context;
 *  - top-level facebook_capi_token/ga4_api_secret/tiktok_access_token/
 *    snapchat_capi_token: the integrations page reads the NESTED
 *    feature_settings.* copies, not these top-level columns.
 */
export const ALWAYS_SAFE_STAFF_REDACTED_FIELDS = [
  'bvn',
  'nin',
  'stripe_customer_id',
  'stripe_subscription_id',
  'virtual_terminal_code',
  'facebook_capi_token',
  'ga4_api_secret',
  'tiktok_access_token',
  'snapchat_capi_token',
] as const satisfies readonly (keyof MerchantData)[];

/**
 * Returns a copy of the merchant with the always-safe secret fields stripped.
 * Call for a non-owner staff member before serializing the dashboard context.
 */
export function redactAlwaysSecretStaffFields(
  merchant: MerchantData
): MerchantData {
  const redacted = { ...merchant };
  for (const field of ALWAYS_SAFE_STAFF_REDACTED_FIELDS) {
    redacted[field] = undefined;
  }
  return redacted;
}
