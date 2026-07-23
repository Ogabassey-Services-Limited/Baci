import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Read a merchant's `paystack_subaccount_code` (revoked from the `authenticated`
 * Postgres role by the S1 containment) through the bounded SECURITY DEFINER RPC
 * `get_merchant_paystack_subaccount_code`, on the caller's authenticated client.
 *
 * The RPC re-derives authorization inside the definer (published storefront for
 * customer payment routing, or owner/active-staff), so it never widens access
 * beyond the raw table. Pass the SAME authenticated client the caller used for
 * its auth checks — never a service-role client (that is what the AGENTS.md
 * service-role policy forbids in these merchant/customer-facing routes).
 */
export async function fetchMerchantPaystackSubaccountCode(
  supabase: SupabaseClient,
  merchantId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc(
    'get_merchant_paystack_subaccount_code',
    { p_merchant_id: merchantId }
  );

  if (error) {
    throw new Error(
      `Failed to load merchant payment configuration: ${error.message}`
    );
  }

  return (data as string | null) ?? null;
}
