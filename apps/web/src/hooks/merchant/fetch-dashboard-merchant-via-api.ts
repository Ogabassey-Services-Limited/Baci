import { defaultStaffAccess } from './constants';
import type { MerchantData, StaffAccess } from './types';

export interface DashboardMerchantResult {
  merchant: MerchantData | null;
  staffAccess: StaffAccess;
}

/**
 * Client-side loader for the signed-in user's dashboard merchant context.
 *
 * Reads through the `/api/merchant/me` server boundary instead of querying
 * `public.merchants` directly with the browser's `authenticated` client. The
 * dashboard needs sensitive own-merchant columns (nin, bvn, bank_*, tokens);
 * S1 revokes those column grants from the `authenticated` role, so this read
 * must run server-side under the service role behind an ownership check.
 */
export async function fetchDashboardMerchantViaApi(): Promise<DashboardMerchantResult> {
  const response = await fetch('/api/merchant/me', {
    credentials: 'same-origin',
  });

  // A missing/expired session is not an error for the provider — it simply
  // means there is no dashboard merchant to show.
  if (response.status === 401) {
    return { merchant: null, staffAccess: { ...defaultStaffAccess } };
  }

  if (!response.ok) {
    throw new Error(`Failed to load merchant dashboard (${response.status})`);
  }

  return (await response.json()) as DashboardMerchantResult;
}
