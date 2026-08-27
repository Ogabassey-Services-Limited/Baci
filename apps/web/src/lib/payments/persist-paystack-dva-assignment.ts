import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  type PaystackDvaAssignment,
  reservePaystackDvaAssignment,
} from '@/lib/payments/reserve-paystack-dva-assignment';
import type { Database } from '@/types/supabase';

export async function persistPaystackDvaAssignment(
  supabase: SupabaseClient<Database>,
  assignment: PaystackDvaAssignment
) {
  const {
    data: reservationStatus,
    error,
    proofError,
  } = await reservePaystackDvaAssignment(supabase, assignment);
  if (proofError) {
    return NextResponse.json(
      {
        error:
          'Unable to reserve a bank account for this order. Please try again.',
        code: 'DVA_PERSISTENCE_FAILED',
      },
      { status: 503 }
    );
  }
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
