import { type NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/wallet/withdraw
 * Manual withdrawal request - transfer to merchant's bank account
 *
 * NOTE: Withdrawals are currently disabled to match UI (canWithdraw: false).
 * This prevents API bypass of disabled functionality.
 */
export function POST(_request: NextRequest) {
  // Withdrawals are temporarily disabled — return 404 to avoid leaking endpoint status
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
