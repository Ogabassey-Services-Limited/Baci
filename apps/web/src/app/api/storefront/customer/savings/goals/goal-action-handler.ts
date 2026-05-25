import { type NextRequest, NextResponse } from 'next/server';
import {
  getCustomerSavingsFeatureSettings,
  resolveCustomerSavingsContext,
} from '@/app/api/storefront/customer/savings/shared';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { customerSavingsGoalActionSchema } from '@/schemas/customer-savings';

type SavingsGoalActionRpcName =
  | 'pause_customer_savings_goal'
  | 'resume_customer_savings_goal'
  | 'cancel_customer_savings_goal_future_debits';

interface SavingsGoalActionRpcRow {
  goal_status: string;
  success: boolean;
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
        : 'Savings goal action failed',
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
    normalized.includes('not_paused') ||
    normalized.includes('not_resumed') ||
    normalized.includes('not_cancellable')
  ) {
    return 409;
  }

  return 500;
}

function isSavingsGoalActionRpcRow(
  row: unknown
): row is SavingsGoalActionRpcRow {
  if (typeof row !== 'object' || row === null) {
    return false;
  }

  const record = row as Record<string, unknown>;
  return (
    typeof record.goal_status === 'string' &&
    typeof record.success === 'boolean'
  );
}

function extractRow(data: unknown) {
  const rows = Array.isArray(data) ? data : [];
  const row = rows[0];
  return isSavingsGoalActionRpcRow(row) ? row : null;
}

export async function executeSavingsGoalAction({
  request,
  rpcName,
}: {
  request: NextRequest;
  rpcName: SavingsGoalActionRpcName;
}) {
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
    const parsed = customerSavingsGoalActionSchema.safeParse(body);
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

    const { data, error } = await resolved.supabase.rpc(rpcName, {
      p_actor_id: auth.user.id,
      p_customer_id: resolved.customer.id,
      p_goal_id: parsed.data.goalId,
      p_merchant_id: resolved.merchant.id,
    });

    if (error) {
      const rpcError = toRpcError(error);
      const status = mapRpcStatus(rpcError?.message ?? '', rpcError?.code);
      if (status === 500) {
        console.error('Failed to update savings goal', error);
      }
      return NextResponse.json(
        {
          code: rpcError?.code ?? 'SAVINGS_GOAL_ACTION_FAILED',
          error:
            status === 500
              ? 'Failed to update savings goal'
              : (rpcError?.message ?? 'Failed to update savings goal'),
        },
        { status }
      );
    }

    const row = extractRow(data);
    if (!row) {
      return NextResponse.json(
        { error: 'Failed to update savings goal' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      goalStatus: row.goal_status,
      success: row.success,
    });
  } catch (error) {
    console.error('Failed to update savings goal', error);
    return NextResponse.json(
      { error: 'Failed to update savings goal' },
      { status: 500 }
    );
  }
}
