import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Read a merchant's `paystack_subaccount_code` (revoked from the `authenticated`
 * Postgres role by the S1 containment) via the service-role client.
 *
 * SECURITY: this bypasses RLS. Call it ONLY after the merchant identity has been
 * resolved on the caller's authenticated/RLS client AND the caller's entitlement
 * to that merchant has been verified (e.g. `resolveVtuCustomer`). Never pass it a
 * raw request-supplied id/slug directly — doing so re-creates a cross-tenant
 * existence oracle over unpublished merchants.
 */
export async function fetchMerchantPaystackSubaccountCode(
  merchantId: string
): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from('merchants')
    .select('paystack_subaccount_code')
    .eq('id', merchantId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load merchant payment configuration: ${error.message}`
    );
  }

  return data?.paystack_subaccount_code ?? null;
}
