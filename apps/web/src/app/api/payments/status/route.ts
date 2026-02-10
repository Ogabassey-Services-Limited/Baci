/**
 * Payment Status Check API
 * Checks the status of a payment session (primarily for crypto payments)
 *
 * GET /api/payments/status?gateway=juicyway&session_id=xxx
 */

import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import {
  extractCryptoAddress,
  getPayment as getJuicywayPayment,
  getPaymentSession as getJuicywaySession,
  verifyPayment as verifyJuicywayPayment,
} from '@/lib/juicyway';
import { verifyTransaction as verifyPaystackPayment } from '@/lib/paystack';

const QuerySchema = z
  .object({
    gateway: z.enum(['juicyway', 'paystack', 'korapay']),
    // payment_id is for Juicyway GET /payments/{id} verification
    // session_id is kept for backwards compatibility
    payment_id: z.string().min(1).optional(),
    session_id: z.string().min(1).optional(),
    reference: z.string().optional(),
    // When true, also check for crypto wallet address availability
    check_address: z.enum(['true', 'false']).optional(),
  })
  .refine((data) => data.payment_id || data.session_id || data.reference, {
    message: 'At least one of payment_id, session_id, or reference is required',
  });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // Note: searchParams.get() returns null for missing params,
    // but Zod's .optional() expects undefined. Use ?? undefined to convert.
    const query = {
      gateway: searchParams.get('gateway'),
      payment_id: searchParams.get('payment_id') ?? undefined,
      session_id: searchParams.get('session_id') ?? undefined,
      reference: searchParams.get('reference') ?? undefined,
      check_address: searchParams.get('check_address') ?? undefined,
    };

    // Debug: Log raw query params
    console.log('[Payment Status] Raw query params:', query);

    const parsed = QuerySchema.safeParse(query);
    if (!parsed.success) {
      console.log(
        '[Payment Status] Zod validation failed:',
        parsed.error.flatten()
      );
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { gateway, payment_id, session_id, reference, check_address } =
      parsed.data;
    const wantAddress = check_address === 'true';

    if (gateway === 'juicyway') {
      // Use payment_id for verification (preferred), fall back to session_id
      const verificationId = payment_id || session_id;

      if (!verificationId) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Either payment_id or session_id is required for Juicyway verification',
            code: 'MISSING_ID',
            gateway: 'juicyway',
          },
          { status: 400 }
        );
      }

      console.log('[Payment Status] Checking Juicyway payment:', {
        payment_id,
        session_id,
        verificationId,
        gateway,
        wantAddress,
      });

      // If client is polling for crypto address, check session + payment endpoints
      if (wantAddress && session_id) {
        const sessionResult = await getJuicywaySession(session_id);

        if (sessionResult.success) {
          const sessionData = sessionResult.data;
          // Juicyway returns address at payment_method.address (docs) or
          // payment_method.params.address (live API). extractCryptoAddress handles both.
          let extracted = extractCryptoAddress(
            sessionData.payment?.payment_method
          );

          // Fallback: check the individual payment endpoint
          if (!extracted && sessionData.payment?.id) {
            const paymentResult = await getJuicywayPayment(
              sessionData.payment.id
            );
            if (paymentResult.success) {
              const pm = paymentResult.data.payment_method as unknown as
                | {
                    address?: string;
                    chain?: string;
                    currency?: string;
                    qrcode?: string;
                    params?: {
                      address: string;
                      chain: string;
                      currency: string;
                    };
                  }
                | undefined;
              const fallbackAddr = pm?.address || pm?.params?.address;
              if (fallbackAddr) {
                // Merge qrcode from session if payment endpoint doesn't have it
                const sessionPm = sessionData.payment?.payment_method as
                  | { qrcode?: string }
                  | undefined;
                extracted = {
                  address: fallbackAddr,
                  chain: pm?.chain || pm?.params?.chain || '',
                  currency: pm?.currency || pm?.params?.currency || '',
                  qrcode: pm?.qrcode || sessionPm?.qrcode,
                };
              }
            }
          }

          if (extracted) {
            return NextResponse.json({
              success: true,
              gateway: 'juicyway',
              status: sessionData.payment?.status || 'pending',
              is_pending: false,
              crypto_address: extracted,
            });
          }

          // Address still not ready
          return NextResponse.json({
            success: true,
            gateway: 'juicyway',
            status: sessionData.payment?.status || 'pending',
            is_pending: true,
            crypto_address: null,
          });
        }
      }

      const result = await verifyJuicywayPayment(verificationId);

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
            payment_id: verificationId,
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
