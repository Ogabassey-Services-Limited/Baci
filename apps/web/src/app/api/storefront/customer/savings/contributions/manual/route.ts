import { type NextRequest, NextResponse } from 'next/server';
import {
  getCustomerSavingsFeatureSettings,
  resolveCustomerSavingsContext,
} from '@/app/api/storefront/customer/savings/shared';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { customerSavingsManualContributionSchema } from '@/schemas/customer-savings';

interface AllocationRpcResult {
  contribution_id: string;
  goal_current_amount: number | string;
  goal_status: string;
  success: boolean;
  wallet_balance: number | string;
  wallet_transaction_id: string | null;
}

function toNumber(value: unknown, fieldName: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid savings contribution ${fieldName}`);
  }

  return parsed;
}

function toRpcError(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const record = error as { code?: unknown; message?: unknown };
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    message:
      typeof record.message === 'string'
        ? record.message
        : 'Savings contribution failed',
  };
}

function mapRpcStatus(message: string, code?: string) {
  const normalized = message.toLowerCase();
  if (
    code === '22023' ||
    normalized.includes('must be') ||
    normalized.includes('required')
  ) {
    return 400;
  }

  if (code === '42501' || normalized.includes('not_authorized')) {
    return 403;
  }

  if (normalized.includes('not_found')) {
    return 404;
  }

  if (
    normalized.includes('insufficient_wallet_balance') ||
    normalized.includes('not_allocatable') ||
    normalized.includes('duplicate_savings_contribution_idempotency_key') ||
    normalized.includes('exceeds_remaining_target')
  ) {
    return 409;
  }

  return 500;
}

function extractRow(data: unknown) {
  const rows = Array.isArray(data) ? data : [];
  const row = rows[0];
  if (!row || typeof row !== 'object') {
    return null;
  }

  return row as AllocationRpcResult;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Malformed JSON', code: 'MALFORMED_JSON' },
        { status: 400 }
      );
    }
    const parsed = customerSavingsManualContributionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const resolved = await resolveCustomerSavingsContext({
      identifiers: parsed.data,
      supabase: auth.supabase,
      user: auth.user,
    });
    if ('response' in resolved) {
      return resolved.response;
    }

    const featureSettings = await getCustomerSavingsFeatureSettings({
      customerId: resolved.customer.id,
      merchantId: resolved.merchant.id,
      supabase: resolved.supabase,
    });
    if (!featureSettings.savingsEnabled) {
      return NextResponse.json(
        {
          code: 'CUSTOMER_SAVINGS_DISABLED',
          error: 'Customer savings is not enabled for this merchant',
        },
        { status: 403 }
      );
    }

    const { data, error } = await resolved.supabase.rpc(
      'allocate_customer_savings_contribution',
      {
        p_amount: parsed.data.amount,
        p_customer_id: resolved.customer.id,
        p_description:
          parsed.data.description ?? 'Manual device savings top-up',
        p_goal_id: parsed.data.goalId,
        p_idempotency_key: parsed.data.idempotencyKey,
        p_merchant_id: resolved.merchant.id,
        p_source_id: null,
        p_source_type: 'wallet',
      }
    );

    if (error) {
      const rpcError = toRpcError(error);
      const status = mapRpcStatus(rpcError?.message ?? '', rpcError?.code);
      if (status === 500) {
        console.error('Failed to add savings contribution', error);
      }
      return NextResponse.json(
        {
          code: rpcError?.code ?? 'SAVINGS_CONTRIBUTION_FAILED',
          error:
            status === 500
              ? 'Failed to add savings contribution'
              : (rpcError?.message ?? 'Failed to add savings contribution'),
        },
        { status }
      );
    }

    const row = extractRow(data);
    if (!row) {
      return NextResponse.json(
        { error: 'Failed to add savings contribution' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      contributionId: row.contribution_id,
      goalCurrentAmount: toNumber(
        row.goal_current_amount,
        'goal_current_amount'
      ),
      goalStatus: row.goal_status,
      success: row.success,
      walletBalance: toNumber(row.wallet_balance, 'wallet_balance'),
      walletTransactionId: row.wallet_transaction_id,
    });
  } catch (error) {
    console.error('Failed to add savings contribution', error);
    return NextResponse.json(
      { error: 'Failed to add savings contribution' },
      { status: 500 }
    );
  }
}
