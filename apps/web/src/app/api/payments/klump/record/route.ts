import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkCsrfProtection } from '@/lib/csrf';
import { createClient } from '@/lib/supabase/server';

const RecordKlumpTransactionSchema = z.object({
  merchant_reference: z.string().startsWith('BAC-').min(5).max(80),
  klump_transaction_id: z.string().min(1).max(200),
  tracking_token: z.string().min(1).max(200),
});

type RecordKlumpCode =
  | 'OK'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'REFERENCE_NOT_UNIQUE'
  | 'KLUMP_ID_CONFLICT';

interface RecordKlumpRpcResult {
  code: RecordKlumpCode;
  transaction_id: string | null;
}

const RECORD_KLUMP_ERRORS: Record<
  Exclude<RecordKlumpCode, 'OK'>,
  { error: string; status: number }
> = {
  NOT_FOUND: {
    error: 'Klump transaction reference was not found',
    status: 404,
  },
  UNAUTHORIZED: {
    error: 'Tracking token does not match this Klump transaction reference',
    status: 401,
  },
  REFERENCE_NOT_UNIQUE: {
    error: 'Klump transaction reference is not unique',
    status: 409,
  },
  KLUMP_ID_CONFLICT: {
    error: 'A different Klump transaction id is already recorded',
    status: 409,
  },
};

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status });
}

function getRpcResult(data: unknown): RecordKlumpRpcResult | null {
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result !== 'object') {
    return null;
  }

  const code = (result as { code?: unknown }).code;
  if (
    code !== 'OK' &&
    code !== 'NOT_FOUND' &&
    code !== 'UNAUTHORIZED' &&
    code !== 'REFERENCE_NOT_UNIQUE' &&
    code !== 'KLUMP_ID_CONFLICT'
  ) {
    return null;
  }

  const transactionId = (result as { transaction_id?: unknown }).transaction_id;

  return {
    code,
    transaction_id:
      typeof transactionId === 'string' || transactionId === null
        ? transactionId
        : null,
  };
}

export async function POST(request: NextRequest) {
  const csrf = await checkCsrfProtection(request);
  if (!csrf.valid) {
    return (
      csrf.response ??
      errorResponse('CSRF validation failed', 'CSRF_VALIDATION_FAILED', 403)
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 'VALIDATION_ERROR', 400);
  }

  const parsed = RecordKlumpTransactionSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return errorResponse(
      `Validation error: ${issue.path.join('.')} - ${issue.message}`,
      'VALIDATION_ERROR',
      400
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_klump_transaction_id', {
    p_merchant_reference: parsed.data.merchant_reference,
    p_klump_transaction_id: parsed.data.klump_transaction_id,
    p_tracking_token: parsed.data.tracking_token,
  });

  if (error) {
    return errorResponse(
      'Failed to record Klump transaction',
      'RPC_FAILED',
      500
    );
  }

  const result = getRpcResult(data);
  if (!result) {
    return errorResponse(
      'Unexpected Klump record result',
      'UNEXPECTED_RPC_RESULT',
      500
    );
  }

  if (result.code !== 'OK') {
    const mapped = RECORD_KLUMP_ERRORS[result.code];
    return errorResponse(mapped.error, result.code, mapped.status);
  }

  return NextResponse.json({
    success: true,
    code: result.code,
    transaction_id: result.transaction_id,
  });
}
