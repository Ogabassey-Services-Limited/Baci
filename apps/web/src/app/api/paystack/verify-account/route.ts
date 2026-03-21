import { type NextRequest, NextResponse } from 'next/server';
import { POST as resolveAccount } from '@/app/api/paystack/resolve/route';
import { checkCsrfProtection } from '@/lib/csrf';

/**
 * Deprecated compatibility wrapper for older web clients.
 *
 * Keep this until all callers have moved to /api/paystack/resolve.
 * The canonical implementation lives in that route.
 */
export async function POST(request: NextRequest) {
  // CSRF protection
  const { valid: csrfValid, response: csrfResponse } =
    await checkCsrfProtection(request);
  if (!csrfValid) {
    return (
      csrfResponse ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  const response = await resolveAccount(request);

  if (!response.ok) {
    return response;
  }

  let body: { account_name?: string; account_number?: string };
  try {
    body = await response.json();
  } catch (error) {
    console.error('Legacy verify-account wrapper parse error:', error);
    return NextResponse.json(
      { error: 'Failed to verify account' },
      { status: 502 }
    );
  }

  return NextResponse.json({
    accountName: body.account_name,
    accountNumber: body.account_number,
  });
}
