import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminMerchantHealthRow } from '@/types/admin-merchants';

interface MerchantHealthViewRow {
  merchant_id: string;
  business_name: string | null;
  joined_at: string;
  total_gmv: number | string;
  total_orders: number;
  last_order_date: string | null;
  active_days: number;
  health_status: 'healthy' | 'at_risk' | 'churned' | 'new';
}

interface MerchantContactRow {
  id: string;
  email: string | null;
}

interface AdminMerchantHealthError {
  code?: string | null;
  message?: string | null;
}

function shouldFallbackToDirectQuery(error: AdminMerchantHealthError): boolean {
  if (error.code === 'PGRST202') {
    return true;
  }

  return error.message?.includes('get_admin_merchant_health') ?? false;
}

export async function getAdminMerchantHealthRows(
  supabase: SupabaseClient
): Promise<{
  data: AdminMerchantHealthRow[] | null;
  error: AdminMerchantHealthError | null;
}> {
  const rpcResult = await supabase.rpc('get_admin_merchant_health');
  if (!rpcResult.error) {
    return {
      data: (rpcResult.data as AdminMerchantHealthRow[] | null) ?? [],
      error: null,
    };
  }

  if (!shouldFallbackToDirectQuery(rpcResult.error)) {
    return {
      data: null,
      error: rpcResult.error,
    };
  }

  const { data: merchantHealthRows, error: merchantHealthError } =
    await supabase
      .from('merchant_health')
      .select(
        'merchant_id, business_name, joined_at, total_gmv, total_orders, last_order_date, active_days, health_status'
      );

  if (merchantHealthError) {
    return {
      data: null,
      error: merchantHealthError,
    };
  }

  const merchantIds = (
    (merchantHealthRows as MerchantHealthViewRow[] | null) ?? []
  ).map((merchant) => merchant.merchant_id);
  const { data: merchantContacts, error: merchantContactsError } =
    merchantIds.length > 0
      ? await supabase
          .from('merchants')
          .select('id, email')
          .in('id', merchantIds)
      : { data: [], error: null };

  if (merchantContactsError) {
    return {
      data: null,
      error: merchantContactsError,
    };
  }

  const emailByMerchantId = new Map(
    ((merchantContacts as MerchantContactRow[] | null) ?? []).map(
      (merchant) => [merchant.id, merchant.email]
    )
  );

  return {
    data:
      (((merchantHealthRows as MerchantHealthViewRow[] | null) ?? []).map(
        (merchant) => ({
          ...merchant,
          email: emailByMerchantId.get(merchant.merchant_id) ?? null,
        })
      ) as AdminMerchantHealthRow[]) ?? [],
    error: null,
  };
}
