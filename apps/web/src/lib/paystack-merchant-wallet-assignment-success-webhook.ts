import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { persistMerchantWalletAssignmentEvent } from './persist-merchant-wallet-assignment-event';

export async function handlePaystackMerchantWalletAssignmentSuccess(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  const assignment = await persistMerchantWalletAssignmentEvent(
    supabase,
    payload
  );
  if (assignment.kind === 'match') {
    return NextResponse.json({
      success: true,
      handled: 'merchant_wallet_assignment',
    });
  }
  if (assignment.kind === 'conflict') {
    return NextResponse.json({
      success: true,
      handled: 'merchant_wallet_alias_conflict',
    });
  }
  if (assignment.kind === 'ignored') {
    return NextResponse.json({ message: 'Event ignored' });
  }
  return NextResponse.json(
    {
      error: 'Paystack assignment accepted for review',
      code: 'MERCHANT_WALLET_ASSIGNMENT_REVIEW',
    },
    { status: 409 }
  );
}
