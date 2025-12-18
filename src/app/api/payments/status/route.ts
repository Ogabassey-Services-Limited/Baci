/**
 * Payment Status Check API
 * Checks the status of a payment session (primarily for crypto payments)
 *
 * GET /api/payments/status?gateway=juicyway&session_id=xxx
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPayment as verifyJuicywayPayment } from '@/lib/juicyway';
import { verifyTransaction as verifyPaystackPayment } from '@/lib/paystack';

const QuerySchema = z.object({
  gateway: z.enum(['juicyway', 'paystack', 'korapay']),
  session_id: z.string().min(1),
  reference: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // Note: searchParams.get() returns null for missing params, 
    // but Zod's .optional() expects undefined. Use ?? undefined to convert.
    const query = {
      gateway: searchParams.get('gateway'),
      session_id: searchParams.get('session_id'),
      reference: searchParams.get('reference') ?? undefined,
    };

    // Debug: Log raw query params
    console.log('[Payment Status] Raw query params:', query);

    const parsed = QuerySchema.safeParse(query);
    if (!parsed.success) {
      console.log('[Payment Status] Zod validation failed:', parsed.error.flatten());
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { gateway, session_id, reference } = parsed.data;

    if (gateway === 'juicyway') {
      // Debug logging
      console.log('[Payment Status] Checking Juicyway payment:', { session_id, gateway });

      const result = await verifyJuicywayPayment(session_id);

      console.log('[Payment Status] Juicyway result:', {
        success: result.success,
        error: result.success ? undefined : result.error,
        code: result.success ? undefined : result.code,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Payment verification failed',
            code: result.code || 'UNKNOWN_ERROR',
            gateway: 'juicyway',
            session_id,
          },
          { status: 400 }
        );
      }

      const { status, payment } = result.data;

      return NextResponse.json({
        success: true,
        gateway: 'juicyway',
        status,
        is_confirmed: status === 'succeeded',
        is_failed: status === 'failed' || status === 'cancelled',
        is_pending: status === 'pending' || status === 'processing',
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          reference: payment.reference,
        },
      });
    }

    if (gateway === 'paystack' && reference) {
      const result = await verifyPaystackPayment(reference);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error, code: result.code },
          { status: 400 }
        );
      }

      const { status } = result.data;

      return NextResponse.json({
        success: true,
        gateway: 'paystack',
        status,
        is_confirmed: status === 'success',
        is_failed: status === 'failed' || status === 'abandoned',
        is_pending: status === 'pending',
        payment: {
          id: result.data.id,
          amount: result.data.amount,
          currency: result.data.currency,
          reference: result.data.reference,
        },
      });
    }

    return NextResponse.json(
      { error: 'Unsupported gateway or missing reference' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Payment status check error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check payment status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
