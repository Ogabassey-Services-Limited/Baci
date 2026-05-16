import { createHmac } from 'node:crypto';
import type { ImeiServiceTierKey } from '@baci/shared/imei';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  hashProviderResponse,
  type ImeiLookupResponseBody,
  readCustomerWalletBalance,
  refundImeiWalletPayment,
  type SickwLookupResult,
} from '@/lib/imei-lookup-fulfillment';
import type { createAdminClient } from '@/lib/supabase/admin';

type AdminSupabaseClient = ReturnType<typeof createAdminClient>;

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ImeiLookupStatus =
  | 'completed'
  | 'failed_error'
  | 'pending'
  | 'refunded_error'
  | 'refunded_not_found'
  | 'refund_pending'
  | 'wallet_rejected';

export interface ImeiLookupRow {
  amount_ngn: number | string;
  cached_response: ImeiLookupResponseBody | null;
  cached_status: number | null;
  customer_id: string;
  id: string;
  imei_hash: string;
  merchant_id: string;
  status: ImeiLookupStatus;
  tier: ImeiServiceTierKey;
}

interface LookupContext {
  customerId: string;
  imeiHash: string;
  merchantId: string;
  tier: ImeiServiceTierKey;
}

export function errorBody({
  balance,
  code,
  error,
  required,
}: {
  balance?: number;
  code: string;
  error: string;
  required?: number;
}): ImeiLookupResponseBody {
  return {
    ...(balance !== undefined ? { balance } : {}),
    code,
    error,
    ...(required !== undefined ? { required } : {}),
    success: false,
  };
}

export function json(body: ImeiLookupResponseBody, status: number) {
  return NextResponse.json(body, { status });
}

export function hashImei(imei: string, salt: string) {
  return createHmac('sha256', salt).update(imei).digest('hex');
}

export function isValidImeiChecksum(imei: string): boolean {
  let sum = 0;
  for (let i = 0; i < imei.length; i++) {
    let digit = Number.parseInt(imei[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit = Math.floor(digit / 10) + (digit % 10);
      }
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === '23505';
}

export function mapExistingLookup(row: ImeiLookupRow, context: LookupContext) {
  if (
    row.customer_id !== context.customerId ||
    row.merchant_id !== context.merchantId
  ) {
    return json(
      errorBody({
        code: 'IDEMPOTENCY_CONFLICT',
        error: 'Idempotency-Key already belongs to another request.',
      }),
      409
    );
  }

  if (row.tier !== context.tier || row.imei_hash !== context.imeiHash) {
    return json(
      errorBody({
        code: 'IDEMPOTENCY_CONFLICT',
        error: 'Idempotency-Key already used with a different request.',
      }),
      409
    );
  }

  if (row.status === 'pending') {
    return json(
      errorBody({
        code: 'IDEMPOTENT_REQUEST_IN_FLIGHT',
        error: 'This IMEI lookup is still processing.',
      }),
      409
    );
  }

  if (row.cached_response && row.cached_status) {
    return json(row.cached_response, row.cached_status);
  }

  return json(
    errorBody({
      code: 'IDEMPOTENCY_CONFLICT',
      error: 'Idempotency-Key has no replayable terminal response.',
    }),
    409
  );
}

export function mapExistingTerminalLookupWithoutImeiHash(
  row: ImeiLookupRow,
  context: Omit<LookupContext, 'imeiHash'>
) {
  if (
    row.customer_id !== context.customerId ||
    row.merchant_id !== context.merchantId
  ) {
    return json(
      errorBody({
        code: 'IDEMPOTENCY_CONFLICT',
        error: 'Idempotency-Key already belongs to another request.',
      }),
      409
    );
  }

  if (row.tier !== context.tier) {
    return json(
      errorBody({
        code: 'IDEMPOTENCY_CONFLICT',
        error: 'Idempotency-Key already used with a different request.',
      }),
      409
    );
  }

  if (row.status === 'pending') {
    return json(
      errorBody({
        code: 'IDEMPOTENT_REQUEST_IN_FLIGHT',
        error: 'This IMEI lookup is still processing.',
      }),
      409
    );
  }

  if (row.cached_response && row.cached_status) {
    return json(row.cached_response, row.cached_status);
  }

  return json(
    errorBody({
      code: 'IDEMPOTENCY_CONFLICT',
      error: 'Idempotency-Key has no replayable terminal response.',
    }),
    409
  );
}

export async function findLookupByIdempotencyKey(
  supabase: SupabaseClient,
  idempotencyKey: string
) {
  const { data, error } = await supabase
    .from('imei_lookups')
    .select(
      'id, customer_id, merchant_id, tier, imei_hash, amount_ngn, status, cached_response, cached_status'
    )
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read IMEI idempotency row: ${error.message}`);
  }

  return (data as ImeiLookupRow | null) ?? null;
}

export async function cacheLookupResponse({
  body,
  lookupId,
  responseHash,
  sickwStatus,
  status,
  supabase,
  terminalStatus,
}: {
  body: ImeiLookupResponseBody;
  lookupId: string;
  responseHash?: string;
  sickwStatus?: string;
  status: number;
  supabase: SupabaseClient;
  terminalStatus: ImeiLookupStatus;
}) {
  const { error } = await supabase
    .from('imei_lookups')
    .update({
      cached_response: body,
      cached_status: status,
      ...(responseHash ? { response_hash: responseHash } : {}),
      ...(sickwStatus ? { sickw_status: sickwStatus } : {}),
      status: terminalStatus,
    })
    .eq('id', lookupId);

  if (error) {
    throw new Error(`Failed to cache IMEI lookup response: ${error.message}`);
  }
}

export async function refundAndCacheFailure({
  amount,
  body,
  customerId,
  lookupId,
  merchantId,
  refundFailureStatus = 'refund_pending',
  refundSuccessStatus,
  sickwStatus,
  status,
  supabase,
  supabaseAdmin,
}: {
  amount: number;
  body: ImeiLookupResponseBody;
  customerId: string;
  lookupId: string;
  merchantId: string;
  refundFailureStatus?: ImeiLookupStatus;
  refundSuccessStatus: ImeiLookupStatus;
  sickwStatus?: string;
  status: number;
  supabase: SupabaseClient;
  supabaseAdmin: AdminSupabaseClient;
}) {
  try {
    await refundImeiWalletPayment({
      amount,
      customerId,
      lookupId,
      merchantId,
      supabaseAdmin,
    });
  } catch (error) {
    console.error('[IMEI Check] Wallet refund failed:', {
      amount,
      customerId,
      error,
      lookupId,
      merchantId,
    });
    const refundPendingBody = errorBody({
      code: 'REFUND_PENDING',
      error:
        'Lookup failed; your refund is pending. We will credit you within 24h.',
    });
    try {
      await cacheLookupResponse({
        body: refundPendingBody,
        lookupId,
        sickwStatus,
        status: 502,
        supabase,
        terminalStatus: refundFailureStatus,
      });
    } catch (cacheError) {
      console.error('[IMEI Check] Failed to cache refund pending state:', {
        cacheError,
        lookupId,
      });
      return json(
        errorBody({
          code: 'REFUND_STATE_SAVE_FAILED',
          error:
            'Lookup failed and refund status could not be saved. Contact support if your wallet is not credited.',
        }),
        500
      );
    }
    return json(refundPendingBody, 502);
  }

  try {
    await cacheLookupResponse({
      body,
      lookupId,
      sickwStatus,
      status,
      supabase,
      terminalStatus: refundSuccessStatus,
    });
  } catch (cacheError) {
    console.error('[IMEI Check] Failed to cache refunded lookup state:', {
      cacheError,
      lookupId,
    });
    return json(
      errorBody({
        code: 'REFUNDED_STATE_SAVE_FAILED',
        error:
          'Lookup failed and refund result could not be saved. Contact support if your wallet is not credited.',
      }),
      500
    );
  }

  return json(body, status);
}

export async function cacheInsufficientBalanceResponse({
  amount,
  customerId,
  lookupId,
  merchantId,
  preflightBalance,
  supabase,
}: {
  amount: number;
  customerId: string;
  lookupId: string;
  merchantId: string;
  preflightBalance: number;
  supabase: SupabaseClient;
}) {
  let currentBalance = preflightBalance;
  try {
    currentBalance = await readCustomerWalletBalance({
      customerId,
      merchantId,
      supabase,
    });
  } catch (readError) {
    console.error('[IMEI Check] Failed to reread wallet balance:', readError);
  }

  const body = errorBody({
    balance: currentBalance,
    code: 'WALLET_INSUFFICIENT',
    error: 'Insufficient wallet balance',
    required: amount,
  });
  await cacheLookupResponse({
    body,
    lookupId,
    status: 402,
    supabase,
    terminalStatus: 'wallet_rejected',
  });
  return json(body, 402);
}

export async function cacheSuccessfulLookup({
  amount,
  customerId,
  latencyMs,
  lookupId,
  merchantId,
  providerResult,
  supabase,
  tier,
}: {
  amount: number;
  customerId: string;
  latencyMs: number;
  lookupId: string;
  merchantId: string;
  providerResult: Extract<SickwLookupResult, { ok: true }>;
  supabase: SupabaseClient;
  tier: ImeiServiceTierKey;
}) {
  // The paid provider lookup already SUCCEEDED here. If persisting the
  // result (our own DB write) fails, we must NOT rethrow: the route's outer
  // catch would see debitSucceeded and route into refundAndCacheFailure,
  // wrongly refunding the customer and discarding a result the merchant
  // already paid SICKW for. Return the result regardless; log loudly so the
  // unpersisted lookup can be reconciled (idempotency replay will re-hit
  // SICKW until it is persisted).
  let persisted = true;
  try {
    await cacheLookupResponse({
      body: providerResult.body,
      lookupId,
      responseHash: hashProviderResponse(providerResult.rawResponseText),
      sickwStatus: providerResult.sickwStatus,
      status: providerResult.status,
      supabase,
      terminalStatus: 'completed',
    });
  } catch (persistError) {
    persisted = false;
    console.error(
      '[IMEI Check] CRITICAL: paid lookup succeeded but result persistence failed; returning result without refund (needs reconciliation)',
      {
        customer_id: customerId,
        error: persistError,
        lookup_id: lookupId,
        merchant_id: merchantId,
      }
    );
  }
  console.info({
    amount,
    customer_id: customerId,
    latency_ms: latencyMs,
    lookup_id: lookupId,
    merchant_id: merchantId,
    outcome: persisted ? 'completed' : 'completed_unpersisted',
    sickw_status: providerResult.sickwStatus,
    tier,
  });
  return json(providerResult.body, providerResult.status);
}
