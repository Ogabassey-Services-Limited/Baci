import type { SupabaseClient } from '@supabase/supabase-js';
import { syncMetaAdsSpendForMerchant } from './sync';

export function createMetaAdsSyncTestCall(rpc: SupabaseClient['rpc']) {
  return (dates?: { endDate: string; startDate: string }) =>
    syncMetaAdsSpendForMerchant({
      endDate: dates?.endDate ?? '2026-08-20',
      merchantId: 'merchant',
      spendSupabase: { rpc } as SupabaseClient,
      startDate: dates?.startDate ?? '2026-08-20',
      supabase: { rpc } as SupabaseClient,
    });
}
