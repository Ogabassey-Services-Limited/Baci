export interface VtuCashbackSummaryPeriod {
  endIso: string;
  label: string;
  period: string;
  startIso: string;
}

export interface VtuCashbackSummaryRow {
  amount: number | string;
  customer:
    | {
        first_name: string | null;
        user_id: string | null;
      }
    | null
    | Array<{
        first_name: string | null;
        user_id: string | null;
      }>;
  customer_id: string;
  id: string;
  merchant:
    | {
        business_name: string | null;
        slug: string | null;
      }
    | null
    | Array<{
        business_name: string | null;
        slug: string | null;
      }>;
  merchant_id: string;
  metadata: Record<string, unknown> | null;
}

export interface VtuCashbackSummaryGroup {
  amount: number;
  customerFirstName: string | null;
  customerId: string;
  merchantId: string;
  merchantName: string;
  merchantSlug: string | null;
  transactionCount: number;
  transactionIds: string[];
  userId: string;
}

interface VtuCashbackSummaryStatusUpdateClient {
  from(table: 'customer_wallet_transactions'): {
    update(values: { metadata: Record<string, unknown> }): {
      eq(
        column: 'id',
        value: string
      ): PromiseLike<{ error: { message?: string } | null }>;
    };
  };
}

const DEFAULT_MERCHANT_NAME = 'Your store';
const DEFAULT_SUMMARY_UPDATE_BATCH_SIZE = 50;
const KOBO_PER_NAIRA = 100;

function readJoinedRecord<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function formatPeriodLabel(date: Date) {
  return new Intl.DateTimeFormat('en-NG', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
}

function toKobo(value: number | string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * KOBO_PER_NAIRA) : 0;
}

function getMetadataPeriod(metadata: Record<string, unknown> | null) {
  const value = metadata?.monthlySummaryPeriod;
  return typeof value === 'string' ? value : undefined;
}

export function getVtuCashbackSummaryIdempotencyKey({
  customerId,
  merchantId,
  period,
}: {
  customerId: string;
  merchantId: string;
  period: string;
}) {
  return `vtu-cashback-summary:${period}:${customerId}:${merchantId}`;
}

export function chunkVtuCashbackSummaryRows<T>(rows: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

export function getPreviousCalendarMonthPeriod(
  now = new Date()
): VtuCashbackSummaryPeriod {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1)
  );
  const period = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;

  return {
    endIso: end.toISOString(),
    label: formatPeriodLabel(start),
    period,
    startIso: start.toISOString(),
  };
}

export function groupVtuCashbackSummaryRows(
  rows: VtuCashbackSummaryRow[],
  period: string
): VtuCashbackSummaryGroup[] {
  const groups = new Map<string, VtuCashbackSummaryGroup>();
  const amountTotals = new Map<string, number>();

  for (const row of rows) {
    if (getMetadataPeriod(row.metadata) === period) {
      continue;
    }

    const customer = readJoinedRecord(row.customer);
    const merchant = readJoinedRecord(row.merchant);
    if (!customer?.user_id) {
      continue;
    }

    const key = `${row.customer_id}:${row.merchant_id}`;
    const existing = groups.get(key);
    const amountKobo = toKobo(row.amount);

    if (existing) {
      const totalKobo = (amountTotals.get(key) ?? 0) + amountKobo;
      amountTotals.set(key, totalKobo);
      existing.amount = totalKobo / KOBO_PER_NAIRA;
      existing.transactionCount += 1;
      existing.transactionIds.push(row.id);
      continue;
    }

    groups.set(key, {
      amount: amountKobo / KOBO_PER_NAIRA,
      customerFirstName: customer.first_name,
      customerId: row.customer_id,
      merchantId: row.merchant_id,
      merchantName: merchant?.business_name ?? DEFAULT_MERCHANT_NAME,
      merchantSlug: merchant?.slug ?? null,
      transactionCount: 1,
      transactionIds: [row.id],
      userId: customer.user_id,
    });
    amountTotals.set(key, amountKobo);
  }

  return Array.from(groups.values());
}

export function buildVtuCashbackSummaryBody({
  amount,
  customerFirstName,
  merchantName,
  periodLabel,
  transactionCount,
}: {
  amount: number;
  customerFirstName: string | null;
  merchantName: string;
  periodLabel: string;
  transactionCount: number;
}) {
  const hasFraction = !Number.isInteger(amount);
  const formattedAmount = new Intl.NumberFormat('en-NG', {
    currency: 'NGN',
    maximumFractionDigits: 2,
    minimumFractionDigits: hasFraction ? 2 : 0,
    style: 'currency',
  }).format(amount);
  const purchaseLabel =
    transactionCount === 1
      ? '1 bill purchase'
      : `${transactionCount} bill purchases`;
  const greeting = customerFirstName ? `${customerFirstName}, ` : '';

  return `${greeting}${merchantName} added ${formattedAmount} to your wallet from ${purchaseLabel} in ${periodLabel}.`;
}

export async function markVtuCashbackTransactionsSummarized(
  supabase: VtuCashbackSummaryStatusUpdateClient,
  rows: VtuCashbackSummaryRow[],
  transactionIds: string[],
  period: string,
  batchSize = DEFAULT_SUMMARY_UPDATE_BATCH_SIZE
) {
  const transactionIdSet = new Set(transactionIds);
  const matchingRows = rows.filter((row) => transactionIdSet.has(row.id));
  const timestamp = new Date().toISOString();
  const failedUpdates: string[] = [];

  for (const rowChunk of chunkVtuCashbackSummaryRows(matchingRows, batchSize)) {
    const updateResults = await Promise.all(
      rowChunk.map((row) =>
        supabase
          .from('customer_wallet_transactions')
          .update({
            metadata: {
              ...(row.metadata ?? {}),
              monthlySummaryPeriod: period,
              monthlySummarySentAt: timestamp,
              monthlySummaryStatus: 'sent',
            },
          })
          .eq('id', row.id)
      )
    );

    failedUpdates.push(
      ...updateResults
        .filter((result) => result.error)
        .map((result) => result.error?.message ?? 'Unknown update error')
    );
  }

  if (failedUpdates.length > 0) {
    throw new Error(
      `${failedUpdates.length} summary row updates failed: ${failedUpdates.join('; ')}`
    );
  }

  return matchingRows.length;
}
