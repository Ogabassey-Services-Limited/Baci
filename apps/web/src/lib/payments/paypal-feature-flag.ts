import 'server-only';

import { scrubLegacyPaypalCredentialFields } from '@/lib/merchant-feature-settings-redaction';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Clears the non-secret PayPal enablement flag (`paypal_enabled`) and scrubs any
 * legacy plaintext PayPal credentials from `merchant_feature_settings`.
 *
 * This runs through the service-role admin client — NOT a caller's RLS-scoped
 * client — because the `merchant_feature_settings` UPDATE policy only covers
 * owner rows. A staff caller (or a service-side checkout path with no
 * `auth.uid()`) would otherwise no-op the update (RLS matches zero rows),
 * leaving `paypal_enabled=true` while the vault credentials are gone/invalid —
 * checkout keeps advertising PayPal and customers hit PAYPAL_NOT_CONFIGURED.
 *
 * Callers MUST have already enforced authorization (the disconnect route gates on
 * `settings.edit`; the checkout paths only reach here after PayPal itself rejects
 * the merchant's stored credentials). Throws on load/update failure so the
 * disconnect route can surface a 500; the checkout path wraps it best-effort.
 */
export async function disablePaypalFeatureFlag(
  merchantId: string
): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('merchant_feature_settings')
    .select('custom_settings')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `payment-credentials: failed to load feature settings: ${error.message}`
    );
  }

  if (!data) {
    return;
  }

  const existing =
    data.custom_settings && typeof data.custom_settings === 'object'
      ? (data.custom_settings as Record<string, unknown>)
      : {};

  // Drop legacy plaintext PayPal secrets so this fully removes stored
  // credentials, not just the vault rows. Reuses the feature-settings scrubber
  // rather than duplicating the credential key list.
  const scrubbed = scrubLegacyPaypalCredentialFields(existing).settings;

  const { error: updateError } = await supabase
    .from('merchant_feature_settings')
    .update({
      custom_settings: { ...scrubbed, paypal_enabled: false },
      updated_at: new Date().toISOString(),
    })
    .eq('merchant_id', merchantId);

  if (updateError) {
    throw new Error(
      `payment-credentials: failed to disable paypal flag: ${updateError.message}`
    );
  }
}
