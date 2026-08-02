import type { AnalyticsState } from '@/lib/analytics-config-diff';
import { supabase } from '@/lib/supabase';

export interface AnalyticsConfigContext {
  analytics: Partial<AnalyticsState>;
  isOwner: boolean;
}

interface MerchantContextPayload {
  merchant?: (Partial<AnalyticsState> & Record<string, unknown>) | null;
  staffAccess?: { isOwner?: boolean } | null;
}

/**
 * Loads the analytics/tracking credential fields for the signed-in user's
 * active merchant.
 *
 * The CAPI/API token columns are revoked from direct authenticated table
 * reads (S1 merchants containment), so selecting them from `merchants` fails
 * with 42501. The SECURITY DEFINER context RPC is the sanctioned read path:
 * it returns tokens for owners and redacts them for staff, which is why
 * callers must gate editing on `isOwner`.
 */
export async function fetchAnalyticsConfigContext(
  merchantId: string
): Promise<AnalyticsConfigContext> {
  const { data, error } = await supabase.rpc('get_merchant_analytics_config', {
    p_merchant_id: merchantId,
  });
  if (error) throw error;

  const payload = data as MerchantContextPayload | null;
  const merchant = payload?.merchant;
  if (!merchant) throw new Error('Merchant profile not found');

  return {
    analytics: merchant,
    isOwner: payload?.staffAccess?.isOwner === true,
  };
}
