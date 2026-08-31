import type { SupabaseClient } from '@supabase/supabase-js';

type JumiaOrderScopeResult =
  | Readonly<{
      kind: 'ok';
      marketplaceKey: string;
      shopId: string;
    }>
  | Readonly<{
      kind: 'database_error';
      message: string;
    }>
  | Readonly<{
      kind: 'not_found';
    }>
  | Readonly<{
      kind: 'invalid_shop';
    }>;

/** Resolves the provider and marketplace identity used to scope cached orders. */
export async function getJumiaOrderScope(
  supabase: SupabaseClient,
  merchantId: string,
  integrationId: string
): Promise<JumiaOrderScopeResult> {
  const { data: integration, error } = await supabase
    .from('marketplace_integrations')
    .select('shop_id, marketplace_key')
    .eq('id', integrationId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (error) return { kind: 'database_error', message: error.message };
  if (!integration) return { kind: 'not_found' };
  if (!integration.shop_id || typeof integration.shop_id !== 'string') {
    return { kind: 'invalid_shop' };
  }

  const marketplaceKey =
    typeof integration.marketplace_key === 'string' &&
    integration.marketplace_key.trim().length > 0
      ? integration.marketplace_key.trim()
      : 'default';

  return {
    kind: 'ok',
    marketplaceKey,
    shopId: integration.shop_id,
  };
}
