import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminMerchantHealthRow } from '@/types/admin-merchants';

export async function getAdminMerchantHealthRows(
  supabase: SupabaseClient
): Promise<{
  data: AdminMerchantHealthRow[];
  error: { code?: string | null; message?: string | null } | null;
}> {
  const rpcResult = await supabase.rpc('get_admin_merchant_health');
  return {
    data: (rpcResult.data as AdminMerchantHealthRow[] | null) ?? [],
    error: rpcResult.error ?? null,
  };
}
