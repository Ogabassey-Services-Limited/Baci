import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const PAGE_SIZE = 500;
const MAX_PAGES = 1000;

export type AnalyticsPaidOrder = Pick<
  Database['public']['Tables']['orders']['Row'],
  'ad_tracking' | 'created_at' | 'id' | 'payment_status' | 'total'
>;

interface FetchPaidOrdersResult {
  data: AnalyticsPaidOrder[];
  error: unknown;
}

/**
 * Reads paid orders in bounded pages so PostgREST's default row limit cannot
 * silently undercount attribution metrics for a busy merchant.
 */
export async function fetchPaidOrdersForAnalytics(
  supabase: SupabaseClient<Database>,
  merchantId: string,
  orderStart: string,
  orderEnd: string
): Promise<FetchPaidOrdersResult> {
  const orders: AnalyticsPaidOrder[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, total, ad_tracking, created_at, payment_status')
      .eq('merchant_id', merchantId)
      .eq('payment_status', 'paid')
      .gte('created_at', orderStart)
      .lte('created_at', orderEnd)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (error) {
      return { data: [], error };
    }

    const pageOrders = (data ?? []) as AnalyticsPaidOrder[];
    orders.push(...pageOrders);

    if (pageOrders.length < PAGE_SIZE) {
      return { data: orders, error: null };
    }
  }

  return {
    data: [],
    error: new Error('ANALYTICS_ORDER_PAGINATION_LIMIT'),
  };
}
