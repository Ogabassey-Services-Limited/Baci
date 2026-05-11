import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminMerchantsSortBy } from '@/schemas/admin-merchants-query';
import type { AdminMerchantHealthRow } from '@/types/admin-merchants';

function toSortableNumber(value: number | string | null | undefined): number {
  const numericValue =
    typeof value === 'string' ? Number.parseFloat(value) : value;
  return typeof numericValue === 'number' && Number.isFinite(numericValue)
    ? numericValue
    : 0;
}

function toSortableTime(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortAdminMerchantHealthRows(
  rows: AdminMerchantHealthRow[],
  sortBy: AdminMerchantsSortBy
): AdminMerchantHealthRow[] {
  return [...rows].sort((left, right) => {
    if (sortBy === 'joined') {
      return toSortableTime(right.joined_at) - toSortableTime(left.joined_at);
    }

    if (sortBy === 'orders') {
      return (
        toSortableNumber(right.total_orders) -
        toSortableNumber(left.total_orders)
      );
    }

    return toSortableNumber(right.total_gmv) - toSortableNumber(left.total_gmv);
  });
}

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
