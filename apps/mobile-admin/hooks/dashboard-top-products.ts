import { supabase } from '@/lib/supabase';
import { ALL_BRANCH_SCOPE, type BranchScope } from '@/schemas/branch';
import type { TopProduct } from './dashboard-stats.types';

type TopProductRpcRow = {
  id: string;
  image_url?: string | null;
  name: string;
  price?: number | null;
  revenue?: number | null;
  total_revenue?: number | null;
  total_sold?: number | null;
  units?: number | null;
};

export async function fetchTopProducts(
  merchantId: string,
  limit: number = 5,
  scope: BranchScope = ALL_BRANCH_SCOPE
): Promise<TopProduct[]> {
  const startDate = new Date(0).toISOString();
  const endDate = new Date().toISOString();

  const { data, error } = await supabase.rpc('get_top_products', {
    p_end_date: endDate,
    p_branch_id: scope.type === 'branch' ? scope.branchId : null,
    p_limit: limit,
    p_merchant_id: merchantId,
    p_start_date: startDate,
  });

  if (error) {
    throw new Error(`fetchTopProducts RPC failed: ${error.message}`);
  }

  return ((data ?? []) as TopProductRpcRow[]).map((p) => ({
    id: p.id,
    imageUrl: p.image_url ?? null,
    name: p.name,
    price: Number(p.price ?? 0),
    totalRevenue: Number(p.total_revenue ?? p.revenue ?? 0),
    totalSold: Number(p.total_sold ?? p.units ?? 0),
  }));
}
