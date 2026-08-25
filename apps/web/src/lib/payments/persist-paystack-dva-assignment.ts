import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { Database } from '@/types/supabase';

interface PaystackDvaAssignment {
  accountName: string;
  accountNumber: string;
  bankName: string;
  customerEmail: string;
  orderId: string;
  expiresAt?: string;
}

export async function persistPaystackDvaAssignment(
  supabase: SupabaseClient<Database>,
  assignment: PaystackDvaAssignment
) {
  const assignedAtMs = Date.now();
  const { data: reservationStatus, error } = await supabase.rpc(
    'reserve_paystack_order_payment_account',
    {
      p_account_name: assignment.accountName,
      p_account_number: assignment.accountNumber,
      p_assigned_at: new Date(assignedAtMs).toISOString(),
      p_bank_name: assignment.bankName,
      p_expires_at:
        assignment.expiresAt ??
        new Date(assignedAtMs + 90 * 60 * 1000).toISOString(),
      p_expected_customer_email: assignment.customerEmail,
      p_order_id: assignment.orderId,
    }
  );
  if (
    !error &&
    (reservationStatus === 'inserted' || reservationStatus === 'existing')
  ) {
    return null;
  }

  logger.error({
    message: 'Failed to persist Paystack DVA assignment',
    orderId: assignment.orderId,
    error,
    reservationStatus,
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
