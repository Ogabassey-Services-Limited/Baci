import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/wallet/withdraw
 * Manual withdrawal request - transfer to merchant's bank account
 *
 * NOTE: Withdrawals are currently disabled to match UI (canWithdraw: false).
 * This prevents API bypass of disabled functionality.
 */
export async function POST(_request: NextRequest) {
  const supabase = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // CSRF protection
  const { valid: csrfValid, response: csrfResponse } =
    await checkCsrfProtection(_request);
  if (!csrfValid) {
    return (
      csrfResponse ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  // Withdrawals are temporarily disabled — return 404 to avoid leaking endpoint status
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
