import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Read whether a merchant's Paystack subaccount is configured, via the derived
 * `get_merchant_paystack_subaccount_configured` SECURITY DEFINER RPC on the
 * caller's authenticated client.
 *
 * The RPC is owner/any-active-staff scoped and never returns the raw
 * `paystack_subaccount_code` (revoked from the `authenticated` role by the S1
 * containment), so dashboard surfaces like the readiness checklist can use it
 * without holding the settings/integrations permissions the raw-code RPC
 * requires.
 */
export async function fetchMerchantPaystackConfigured(
  supabase: SupabaseClient,
  merchantId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    'get_merchant_paystack_subaccount_configured',
    { p_merchant_id: merchantId }
  );

  if (error) {
    throw new Error(
      `Failed to load merchant payment configuration: ${error.message}`
    );
  }

  return data === true;
}
