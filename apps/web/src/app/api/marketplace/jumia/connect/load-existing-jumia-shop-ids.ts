import type { SupabaseClient } from '@supabase/supabase-js';
import { buildExistingJumiaShopIds } from '@/lib/jumia/jumia-shop-connection-identity';

export async function loadExistingJumiaShopIds(
  supabase: SupabaseClient,
  merchantId: string
): Promise<Set<string>> {
  const { data: existing, error } = await supabase
    .from('marketplace_integrations')
    .select('shop_id, country_code, marketplace_key, connection_method')
    .eq('merchant_id', merchantId)
    .eq('platform', 'jumia')
    .eq('is_active', true);
  if (error) {
    throw new Error('Failed to load existing Jumia shops');
  }
  return buildExistingJumiaShopIds(existing ?? []);
}
