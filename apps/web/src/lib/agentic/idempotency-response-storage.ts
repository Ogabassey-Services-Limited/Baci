import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { storeAgenticIdempotencyResponse } from '@/lib/agentic/idempotency';
import { logger } from '@/lib/logger';

function jsonResponse(
  response: unknown,
  init: ResponseInit,
  context: {
    idempotencyKey: string;
    merchantId: string;
    requestId: string;
    route: string;
  }
) {
  try {
    return NextResponse.json(response, init);
  } catch (error) {
    logger.error({
      message: 'Failed to serialize agentic idempotency response',
      error,
      ...context,
    });
    return NextResponse.json(
      { error: 'Idempotency response serialization failed' },
      { ...init, status: 500 }
    );
  }
}

/**
 * Stores and returns an idempotent JSON response for agentic mutations.
 *
 * The response payload must be JSON-serializable because it is both returned
 * through NextResponse.json and stored for future idempotency replays.
 */
export async function buildStoredAgenticIdempotencyResponse({
  idempotencyKey,
  merchantId,
  requestId,
  response,
  route,
  status,
  storageFailureResponse,
  supabase,
}: {
  idempotencyKey: string;
  merchantId: string;
  requestId: string;
  response: unknown;
  route: string;
  status: number;
  storageFailureResponse?: Record<string, unknown>;
  supabase: SupabaseClient;
}): Promise<NextResponse> {
  const headers = {
    'idempotency-key': idempotencyKey,
    'request-id': requestId,
  };
  const logContext = { idempotencyKey, merchantId, requestId, route };
  const validatedStatus =
    Number.isInteger(status) && status >= 200 && status <= 599 ? status : 500;
  let stored: { error: unknown; ok: boolean };
  try {
    stored = await storeAgenticIdempotencyResponse({
      key: idempotencyKey,
      merchantId,
      response,
      route,
      status: validatedStatus,
      supabase,
    });
  } catch (error) {
    stored = { error, ok: false };
  }

  if (!stored.ok) {
    logger.error({
      message: 'Failed to store agentic idempotency response',
      error: stored.error,
      idempotencyKey,
      merchantId,
      requestId,
      route,
    });
    const warningHeaders = {
      ...headers,
      'x-idempotency-warning': 'response-not-stored',
    };
    if (validatedStatus < 500 && !storageFailureResponse) {
      return jsonResponse(
        response,
        {
          headers: warningHeaders,
          status: validatedStatus,
        },
        logContext
      );
    }

    return jsonResponse(
      storageFailureResponse ?? {
        error: 'Idempotency response storage failed',
      },
      { headers: warningHeaders, status: 503 },
      logContext
    );
  }

  return jsonResponse(
    response,
    { headers, status: validatedStatus },
    logContext
  );
}
