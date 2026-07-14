import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import {
  fetchDashboardMerchant,
  fetchPrimaryDomain,
} from '@/hooks/merchant/queries';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

// This route returns per-user SECRET merchant data (bank/nin/bvn/tokens). It
// must never be stored by any shared cache/CDN. Reading cookies() already opts
// the handler into dynamic rendering; this header is explicit defense in depth,
// matching the repo convention (see api/merchant/features/route.ts).
const PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
} as const;

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
 * Security: authentication and reads use the cookie-bound client, while
 * `fetchDashboardMerchant` additionally enforces `WHERE user_id =
 * <session user.id>` / active-staff scoping. A later column-ACL change must use
 * a caller-bound RPC rather than introducing a service-role client here.
 */
export async function GET(_request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: PRIVATE_NO_STORE }
    );
  }

  try {
    const { merchant, staffAccess } = await fetchDashboardMerchant(
      supabase,
      user.id
    );

    if (merchant?.id) {
      const domain = await fetchPrimaryDomain(supabase, merchant.id);
      if (domain) {
        merchant.custom_domain = domain;
      }
    }

    return NextResponse.json(
      { merchant, staffAccess },
      { headers: PRIVATE_NO_STORE }
    );
  } catch (error) {
    logger.error({
      message: 'Failed to resolve current merchant dashboard context',
      error: error instanceof Error ? error : new Error('Unknown error'),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: PRIVATE_NO_STORE }
    );
  }
}
