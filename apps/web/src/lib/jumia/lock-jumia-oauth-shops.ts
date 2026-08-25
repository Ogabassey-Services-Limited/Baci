import type { SupabaseClient } from '@supabase/supabase-js';

export async function lockJumiaOAuthShops(
  supabase: Pick<SupabaseClient, 'rpc'>,
  merchantId: string,
  shopIds: string[]
): Promise<boolean> {
  if (shopIds.length === 0) return true;
  const { error } = await supabase.rpc('lock_jumia_oauth_shops', {
    p_merchant_id: merchantId,
    p_shop_ids: shopIds,
  });
  return !error;
}
