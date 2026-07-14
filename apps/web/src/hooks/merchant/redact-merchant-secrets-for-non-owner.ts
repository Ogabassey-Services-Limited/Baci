import type { MerchantData, StaffAccess } from './types';

/**
 * Owner-only secret columns with NO client `useMerchant()` consumer — always
 * stripped for a non-owner staff member. The dashboard merchant context is
 * resolved under the service role (which bypasses RLS), so this redaction is the
 * boundary that keeps low-privilege staff from reading the owner's identity /
 * billing / marketing credentials. Any surface a permitted staffer legitimately
 * needs (e.g. marketing tokens) fetches through its own permission-scoped
 * endpoint (`/api/merchant/features`), not this shared context.
 */
export const NON_OWNER_ALWAYS_REDACTED_FIELDS = [
  'nin',
  'bvn',
  'stripe_customer_id',
  'stripe_subscription_id',
  'facebook_capi_token',
  'ga4_api_secret',
  'tiktok_access_token',
  'snapchat_capi_token',
  'virtual_terminal_code',
  'legal_entity_name',
  'registered_address',
  'tax_identification_number',
  'cac_rc_number',
  'kyc_status',
] as const satisfies readonly (keyof MerchantData)[];

/**
 * Payment/payout secrets. The payment-settings dashboard page reads these off
 * `useMerchant()`, so they are kept for a staff member who can access settings
 * and stripped for everyone else.
 */
export const NON_OWNER_PAYMENT_FIELDS = [
  'bank_account_number',
  'bank_account_name',
  'bank_code',
  'bank_name',
  'paystack_subaccount_code',
] as const satisfies readonly (keyof MerchantData)[];

/**
 * Secret credential keys carried at the top level of the embedded
 * `feature_settings:merchant_feature_settings(*)` projection.
 */
export const NON_OWNER_REDACTED_FEATURE_SETTINGS_KEYS = [
  'facebook_capi_token',
  'ga4_api_secret',
  'tiktok_access_token',
  'snapchat_capi_token',
  'credit_direct_public_key',
] as const;

type PermissionMap = Record<string, Record<string, boolean>>;

/**
 * Mirrors `hasPermission` (lib/api-auth.ts) for the non-owner case: honors the
 * `full_access.all`, `'*':'*'`, `'*':action`, `resource:'*'`, and
 * `resource:action` grant shapes. Kept local so the redactor does not depend on
 * the API `UserAccess` shape (StaffAccess lacks merchantId).
 */
function staffHasPermission(
  permissions: PermissionMap,
  resource: string,
  action: string
): boolean {
  return (
    permissions.full_access?.all === true ||
    permissions['*']?.['*'] === true ||
    permissions['*']?.[action] === true ||
    permissions[resource]?.['*'] === true ||
    permissions[resource]?.[action] === true
  );
}

/**
 * Returns a copy of the merchant with owner-only secrets stripped for a non-owner
 * staff member, scoped by permission:
 *  - always-secret fields (identity/billing/marketing creds) are removed;
 *  - bank/paystack payout fields are kept only for staff with `settings` access
 *    (the payment-settings page needs them) and removed otherwise;
 *  - `google_product_sheet_url` is kept only for staff with `products` access;
 *  - the embedded feature-settings credentials and the arbitrary
 *    `custom_settings` bag are removed.
 */
export function redactMerchantSecretsForNonOwner(
  merchant: MerchantData,
  staffAccess: StaffAccess
): MerchantData {
  const redacted = { ...merchant };
  const permissions = staffAccess.permissions ?? {};

  for (const field of NON_OWNER_ALWAYS_REDACTED_FIELDS) {
    redacted[field] = undefined;
  }

  if (!staffHasPermission(permissions, 'settings', 'view')) {
    for (const field of NON_OWNER_PAYMENT_FIELDS) {
      redacted[field] = undefined;
    }
  }

  if (!staffHasPermission(permissions, 'products', 'view')) {
    redacted.google_product_sheet_url = undefined;
  }

  if (redacted.feature_settings) {
    const featureSettings = { ...redacted.feature_settings };
    for (const key of NON_OWNER_REDACTED_FEATURE_SETTINGS_KEYS) {
      featureSettings[key] = undefined;
    }
    // The custom_settings bag accepts arbitrary keys and may hold integration
    // credentials (e.g. Zoho Campaigns tokens, draft_secret). No non-owner
    // surface reads it from this context, so drop it wholesale.
    featureSettings.custom_settings = undefined;
    redacted.feature_settings = featureSettings;
  }

  return redacted;
}
