import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';
import { resolveGrandfatheredPaymentPendingReplay } from './agentic-paystack-dva-grandfathered-response';
import { isAgenticPaystackDvaPaused } from './agentic-paystack-dva-paused';
import { AGENTIC_PAYSTACK_DVA_PAUSED_ERROR } from './agentic-paystack-dva-paused-error';
import { getAgenticCheckoutSession } from './checkout-session-record';
import type { IdempotencyReservationResult } from './idempotency';

type ReplayResult = Extract<IdempotencyReservationResult, { state: 'replay' }>;

export async function buildAgenticPaystackDvaIdempotencyReplayResponse({
  idempotencyKey,
  merchantId,
  paymentProvider,
  replay,
  requestId,
  sessionId,
  supabase,
}: {
  idempotencyKey: string;
  merchantId: string;
  paymentProvider: string;
  replay: ReplayResult;
  requestId: string;
  sessionId: string;
  supabase: SupabaseClient;
}) {
  const headers = {
    'idempotency-key': idempotencyKey,
    'request-id': requestId,
  };
  if (paymentProvider !== 'paystack' || !isAgenticPaystackDvaPaused()) {
    return NextResponse.json(replay.response, {
      headers,
      status: replay.status,
    });
  }

  const { data: session, error } = await getAgenticCheckoutSession({
    merchantId,
    sessionId,
    supabase,
  });
  if (error) {
    logger.error({
      error: sanitizeForLog(error),
      message: 'Paused Agentic DVA replay session read failed',
      merchantId,
      sessionId,
    });
    return NextResponse.json(
      { error: 'Database error' },
      { headers, status: 500 }
    );
  }

  const grandfathered = session
    ? resolveGrandfatheredPaymentPendingReplay({
        replay: {
          requestHash: replay.requestHash,
          response: replay.response,
          status: replay.status,
        },
        session,
      })
    : null;
  if (!grandfathered) {
    return NextResponse.json(AGENTIC_PAYSTACK_DVA_PAUSED_ERROR, {
      headers,
      status: 409,
    });
  }

  return NextResponse.json(grandfathered.body, {
    headers,
    status: grandfathered.status,
  });
}
