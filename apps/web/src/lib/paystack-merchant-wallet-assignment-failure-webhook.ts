import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { failMerchantWalletAssignmentEvent } from './merchant-wallet-assignment-events';

export async function handlePaystackMerchantWalletAssignmentFailure(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  const assignment = await failMerchantWalletAssignmentEvent(supabase, payload);
  if (assignment.kind === 'match') {
    return NextResponse.json({
      success: true,
      handled: 'merchant_wallet_assignment_failure',
    });
  }
  if (assignment.kind === 'ignored') {
    return NextResponse.json({ message: 'Event ignored' });
  }
  return NextResponse.json(
    {
      error: 'Paystack assignment failure accepted for review',
      code: 'MERCHANT_WALLET_ASSIGNMENT_FAILURE_REVIEW',
    },
    { status: 409 }
  );
}
