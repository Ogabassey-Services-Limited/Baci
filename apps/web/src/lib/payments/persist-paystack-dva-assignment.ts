import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { Database } from '@/types/supabase';

interface PaystackDvaAssignment {
  accountName: string;
  accountNumber: string;
  amount: number;
  bankName: string;
  orderId: string;
}

export async function persistPaystackDvaAssignment(
  supabase: SupabaseClient<Database>,
  assignment: PaystackDvaAssignment
) {
  const assignedAtMs = Date.now();
  const { error } = await supabase.from('order_payment_accounts').upsert(
    {
      order_id: assignment.orderId,
      account_number: assignment.accountNumber,
      bank_name: assignment.bankName,
      account_name: assignment.accountName,
      provider: 'paystack',
      payable_amount: assignment.amount,
      assigned_at: new Date(assignedAtMs).toISOString(),
      expires_at: new Date(assignedAtMs + 90 * 60 * 1000).toISOString(),
    },
    { onConflict: 'order_id,provider' }
  );
  if (!error) return null;

  logger.error({
    message: 'Failed to persist Paystack DVA assignment',
    orderId: assignment.orderId,
    error,
  });
  return NextResponse.json(
    {
      error:
        'Unable to reserve a bank account for this order. Please try again.',
      code: 'DVA_PERSISTENCE_FAILED',
    },
    { status: 503 }
  );
}
