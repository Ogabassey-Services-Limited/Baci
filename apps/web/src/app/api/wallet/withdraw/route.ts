import { type NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/wallet/withdraw
 * Manual withdrawal request - transfer to merchant's bank account
 *
 * NOTE: Withdrawals are currently disabled to match UI (canWithdraw: false).
 * This prevents API bypass of disabled functionality.
 */
export function POST(_request: NextRequest) {
  // Security: Withdrawals are temporarily disabled for manual review
  // This matches the UI logic (canWithdraw: false) to prevent API bypass
  return NextResponse.json(
    {
      error: 'Withdrawals are temporarily disabled',
      message:
        'Manual withdrawals are currently paused. Please contact support.',
    },
    { status: 403 }
  );
}
