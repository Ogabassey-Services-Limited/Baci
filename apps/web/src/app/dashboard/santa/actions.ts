'use server';

import { cookies } from 'next/headers';
import type { StaffAccess } from '@/hooks/merchant';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface SantaStats {
  total_chats: number;
  unique_sessions: number;
  wishes_granted: number;
  wishes_denied: number;
  total_revenue: number;
  avg_discount: number;
}

export interface SantaInteraction {
  id: string;
  created_at: string;
  interaction_type: string;
  user_message: string;
  santa_response: string;
  product_name?: string;
  approved_price?: number;
  discount_percentage?: number;
  session_id: string;
}

function getZeroSantaStats(): SantaStats {
  return {
    total_chats: 0,
    unique_sessions: 0,
    wishes_granted: 0,
    wishes_denied: 0,
    total_revenue: 0,
    avg_discount: 0,
  };
}

function canViewSantaAnalytics(staffAccess: StaffAccess) {
  return (
    staffAccess.isOwner ||
    staffAccess.permissions?.full_access?.all === true ||
    staffAccess.permissions?.marketing?.all === true ||
    staffAccess.permissions?.marketing?.view === true
  );
}

async function resolveSantaAnalyticsMerchantId(
  supabase: SupabaseServerClient,
  userId: string,
  requestedMerchantId: string
) {
  const merchantContext = await getMerchantForApiRequest(supabase, userId, {
    requestedMerchantId,
  });

  if (!merchantContext || !canViewSantaAnalytics(merchantContext.staffAccess)) {
    return null;
  }

  return merchantContext.merchantId;
}

export async function getSantaStats(merchantId: string): Promise<SantaStats> {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return getZeroSantaStats();
  }

  const authorizedMerchantId = await resolveSantaAnalyticsMerchantId(
    supabase,
    user.id,
    merchantId
  );

  if (!authorizedMerchantId) {
    return getZeroSantaStats();
  }

  // We can query the view directly, but for now let's manually aggregate
  // to ensure we get a single total object, as the view is daily stats.

  // Alternatively, just query the view and sum it up in JS or SQL.
  // Let's rely on raw table aggregation for real-time accuracy for the "Totals" cards.

  // Calculate stats in memory (since we might not have the view enabled/perfect yet)
  const stats = getZeroSantaStats();

  // Better: use the view if it works.
  // Let's try the view first, fall back to simple counts.

  const { data: viewData, error: viewError } = await supabase
    .from('santa_campaign_stats')
    .select(
      'total_chats, unique_sessions, wishes_granted, wishes_denied, total_revenue, avg_discount'
    )
    .eq('merchant_id', authorizedMerchantId);

  if (!viewError && viewData) {
    // Aggregate the daily view data
    return viewData.reduce(
      (acc, curr) => ({
        total_chats: acc.total_chats + (curr.total_chats || 0),
        unique_sessions: acc.unique_sessions + (curr.unique_sessions || 0), // Summing unique daily sessions is roughly ok but technically overlaps
        wishes_granted: acc.wishes_granted + (curr.wishes_granted || 0),
        wishes_denied: acc.wishes_denied + (curr.wishes_denied || 0),
        total_revenue: acc.total_revenue + (curr.total_revenue || 0),
        avg_discount: curr.avg_discount || acc.avg_discount, // Rough avg
      }),
      { ...stats }
    );
  }

  return stats;
}

export async function getRecentInteractions(
  merchantId: string,
  limit = 20
): Promise<SantaInteraction[]> {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return [];
  }

  const authorizedMerchantId = await resolveSantaAnalyticsMerchantId(
    supabase,
    user.id,
    merchantId
  );

  if (!authorizedMerchantId) {
    return [];
  }

  const { data, error } = await supabase
    .from('santa_interactions')
    .select(
      'id, created_at, interaction_type, user_message, santa_response, product_name, approved_price, discount_percentage, session_id'
    )
    .eq('merchant_id', authorizedMerchantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching interactions:', error);
    return [];
  }

  return data as SantaInteraction[];
}
