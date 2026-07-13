import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import {
  fetchDashboardMerchant,
  fetchPrimaryDomain,
} from '@/hooks/merchant/queries';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Current merchant dashboard context (owner or active staff) for the signed-in
 * user.
 *
 * Why this route exists (S1): the merchant dashboard reads highly sensitive
 * own-merchant columns (nin, bvn, bank_*, stripe_*, CAPI/access tokens,
 * paystack_subaccount_code). Those reads previously ran through the browser's
 * `authenticated` Supabase client straight against `public.merchants`, which
 * forced the table's column grant to expose every secret column to the
 * `authenticated` role — and, combined with the `USING (true)` SELECT policy,
 * let ANY signed-in user read ANY merchant's secrets. This route moves the
 * own-row read behind a server boundary so S1 can revoke those column grants.
 *
 * Security: authentication is verified first via the cookie-bound client. The
 * service-role read runs ONLY after that gate, and ownership is enforced by
 * `fetchDashboardMerchant`'s `WHERE user_id = <session user.id>` / active-staff
 * lookup — the caller can never resolve a merchant they do not own or staff.
 */
export async function GET(_request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { merchant, staffAccess } = await fetchDashboardMerchant(
      admin,
      user.id
    );

    if (merchant?.id) {
      const domain = await fetchPrimaryDomain(admin, merchant.id);
      if (domain) {
        merchant.custom_domain = domain;
      }
    }

    return NextResponse.json({ merchant, staffAccess });
  } catch (error) {
    logger.error({
      message: 'Failed to resolve current merchant dashboard context',
      error: error instanceof Error ? error : new Error('Unknown error'),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
