import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * Read the caller-authorized aggregate identity-verification state used by
 * dashboard readiness surfaces. The bounded RPC never returns identity values
 * or individual verification flags.
 */
export async function fetchMerchantIdentityVerified(
  supabase: SupabaseClient<Database>,
  merchantId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('get_merchant_identity_verified', {
    p_merchant_id: merchantId,
  });

  if (error) {
    throw new Error(
      `Failed to load merchant identity verification: ${error.message}`
    );
  }

  return data === true;
}
