import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { notifyCustomer } from '@/lib/expo-push';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildVtuCashbackSummaryBody,
  getPreviousCalendarMonthPeriod,
  getVtuCashbackSummaryIdempotencyKey,
  groupVtuCashbackSummaryRows,
  markVtuCashbackTransactionsSummarized,
  type VtuCashbackSummaryRow,
} from '@/lib/vtu-cashback-summary';
import { vtuCashbackSummaryCronQuerySchema } from '@/schemas/vtu-cashback-summary-cron';

const PAGE_SIZE = 500;
const MAX_ERROR_COUNT = 10;

function getAuthorizedCronResponse(request: NextRequest) {
  const cronSecret = getCronSecret();
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('Authorization');
  const expectedToken = `Bearer ${cronSecret}`;
  if (!authHeader || !constantTimeEqual(authHeader, expectedToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isCustomerJoin(value: unknown) {
  return (
    isRecord(value) &&
    isNullableString(value.first_name) &&
    isNullableString(value.user_id)
  );
}

function isMerchantJoin(value: unknown) {
  return (
    isRecord(value) &&
    isNullableString(value.business_name) &&
    isNullableString(value.slug)
  );
}

function isJoinedRecord(value: unknown, guard: (item: unknown) => boolean) {
  if (Array.isArray(value)) {
    return value.every(guard);
  }

  return guard(value);
}

function isVtuCashbackSummaryRow(
  value: unknown
): value is VtuCashbackSummaryRow {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.customer_id === 'string' &&
    typeof value.merchant_id === 'string' &&
    (typeof value.amount === 'number' || typeof value.amount === 'string') &&
    isJoinedRecord(value.customer, isCustomerJoin) &&
    isJoinedRecord(value.merchant, isMerchantJoin) &&
    (isRecord(value.metadata) || value.metadata === null)
  );
}

async function fetchCashbackRows(
  supabase: ReturnType<typeof createAdminClient>,
  startIso: string,
  endIso: string
) {
  const rows: VtuCashbackSummaryRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('customer_wallet_transactions')
      .select(
        'id, customer_id, merchant_id, amount, metadata, customer:customers(first_name, user_id), merchant:merchants(business_name, slug)'
      )
      .eq('type', 'cashback')
      .eq('source_type', 'vtu_transaction')
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .is('metadata->>monthlySummaryPeriod', null)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    if (Array.isArray(data)) {
      const validRows: VtuCashbackSummaryRow[] = [];
      const invalidRows: unknown[] = [];
      for (const item of data) {
        if (isVtuCashbackSummaryRow(item)) {
          validRows.push(item);
        } else {
          invalidRows.push(item);
        }
      }
      if (invalidRows.length > 0) {
        // Redact PII (first_name, user_id, business_name, slug) from the log
        // sample. Only keep row id (when it's a string) and shape metadata.
        const redactedSample = invalidRows.slice(0, 3).map((row) => {
          if (!row || typeof row !== 'object') {
            return { type: typeof row };
          }
          const record = row as Record<string, unknown>;
          const id = typeof record.id === 'string' ? record.id : undefined;
          return { id, keys: Object.keys(record) };
        });
        console.warn(
          'VTU cashback summary: dropped %d invalid row(s) from page (offset %d)',
          invalidRows.length,
          from,
          { sample: redactedSample }
        );
      }
      rows.push(...validRows);
    }

    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function hasCompletedSummaryNotificationAttempt(
  supabase: ReturnType<typeof createAdminClient>,
  idempotencyKey: string
) {
  const { data, error } = await supabase
    .from('push_notification_attempts')
    .select('id')
    .eq('app_type', 'storefront')
    .eq('notification_type', 'vtu_cashback_monthly_summary')
    .eq('payload->>idempotency_key', idempotencyKey)
    .in('status', ['sent', 'skipped_no_tokens'])
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

// Manual fallback only; scheduled execution should be handled by the VPS cron runner.
export async function GET(request: NextRequest) {
  const unauthorizedResponse = getAuthorizedCronResponse(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const queryResult = vtuCashbackSummaryCronQuerySchema.safeParse({
    now: request.nextUrl.searchParams.get('now') ?? undefined,
  });
  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid now parameter' },
      { status: 400 }
    );
  }

  const now = queryResult.data.now
    ? new Date(queryResult.data.now)
    : new Date();
  const period = getPreviousCalendarMonthPeriod(now);
  const supabase = createAdminClient();
  let rows: VtuCashbackSummaryRow[];

  try {
    rows = await fetchCashbackRows(supabase, period.startIso, period.endIso);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load cashback rows';
    console.error('Failed to load VTU cashback summary rows:', {
      error: message,
      period: period.period,
    });
    return NextResponse.json(
      { error: 'Failed to load cashback rows' },
      { status: 500 }
    );
  }

  const groups = groupVtuCashbackSummaryRows(rows, period.period);

  let summariesSent = 0;
  let summariesSkipped = 0;
  let summariesFailed = 0;
  let transactionsMarked = 0;
  const errors: string[] = [];

  for (const group of groups) {
    const idempotencyKey = getVtuCashbackSummaryIdempotencyKey({
      customerId: group.customerId,
      merchantId: group.merchantId,
      period: period.period,
    });
    const title = `Your ${group.merchantName} bill rewards`;
    const body = buildVtuCashbackSummaryBody({
      amount: group.amount,
      customerFirstName: group.customerFirstName,
      merchantName: group.merchantName,
      periodLabel: period.label,
      transactionCount: group.transactionCount,
    });

    let notificationSent = false;
    try {
      const alreadyNotified = await hasCompletedSummaryNotificationAttempt(
        supabase,
        idempotencyKey
      );

      if (!alreadyNotified) {
        const result = await notifyCustomer(
          group.userId,
          title,
          body,
          {
            amount: group.amount,
            merchant_id: group.merchantId,
            merchant_slug: group.merchantSlug,
            period: period.period,
            transaction_count: group.transactionCount,
            idempotency_key: idempotencyKey,
            type: 'vtu_cashback_monthly_summary',
          },
          'promotions'
        );

        if (result.failed > 0 || result.errors.length > 0) {
          summariesFailed += 1;
          errors.push(...result.errors);
          continue;
        }

        notificationSent = true;
      }
    } catch (error) {
      summariesFailed += 1;
      const message =
        error instanceof Error ? error.message : 'Failed to send summary';
      errors.push(message);
      console.error('Failed to send VTU cashback summary:', {
        error: message,
        idempotencyKey,
        period: period.period,
      });
      continue;
    }

    try {
      const markedCount = await markVtuCashbackTransactionsSummarized(
        supabase,
        rows,
        group.transactionIds,
        period.period
      );
      if (notificationSent) {
        summariesSent += 1;
      } else {
        summariesSkipped += 1;
      }
      transactionsMarked += markedCount;
    } catch (error) {
      summariesFailed += 1;
      const message =
        error instanceof Error ? error.message : 'Failed to mark summary rows';
      errors.push(message);
      console.error('Failed to mark VTU cashback summary rows:', {
        error: message,
        period: period.period,
        transactionCount: group.transactionIds.length,
        transactionSample: group.transactionIds.slice(0, 5),
      });
    }
  }

  return NextResponse.json({
    errors: errors.slice(0, MAX_ERROR_COUNT),
    groupsProcessed: groups.length,
    period: period.period,
    summariesFailed,
    summariesSent,
    summariesSkipped,
    transactionsMarked,
  });
}
