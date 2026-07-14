import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import { markPaypalTransactionRefunded } from './mark-paypal-transaction-refunded';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}));

const TXN_ID = 'txn-1';

/**
 * Chainable Supabase mock capturing the update payload and the filters, so we can
 * assert BOTH what we write and what we refuse to write over.
 */
function makeSupabase(result: { error?: unknown } = {}) {
  const captured: {
    update?: Record<string, unknown>;
    eqId?: string;
    inStatuses?: string[];
  } = {};

  const builder: Record<string, unknown> = {
    select: () => builder,
    update: (payload: Record<string, unknown>) => {
      captured.update = payload;
      return builder;
    },
    eq: (_col: string, value: string) => {
      captured.eqId = value;
      return builder;
    },
    in: (_col: string, values: string[]) => {
      captured.inStatuses = values;
      return Promise.resolve({ error: result.error ?? null });
    },
    maybeSingle: () =>
      Promise.resolve({ data: { metadata: { existing: true } }, error: null }),
  };

  return {
    client: { from: () => builder } as unknown as SupabaseClient,
    captured,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * The status values `transactions_status_check` actually permits (see migration
 * 20260714090000). Writing anything outside this set fails the CHECK constraint —
 * and because this stamp is best-effort, that failure is logged and SWALLOWED,
 * leaving a refunded capture that still looks settleable. That is exactly the bug
 * this module exists to prevent, and mocked Supabase cannot catch it, so the
 * allowed set is asserted here explicitly.
 */
const DB_ALLOWED_TRANSACTION_STATUSES = new Set([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'refunded',
  'refund_pending',
]);

describe('markPaypalTransactionRefunded', () => {
  it('stamps the refunded transaction so no later path can settle against it', async () => {
    const { client, captured } = makeSupabase();

    await markPaypalTransactionRefunded(client, TXN_ID, 'duplicate capture');

    expect(captured.update).toMatchObject({ status: 'refunded' });
    expect(captured.eqId).toBe(TXN_ID);
  });

  it('writes a status the DB CHECK constraint actually permits', async () => {
    const { client, captured } = makeSupabase();

    await markPaypalTransactionRefunded(client, TXN_ID, 'duplicate capture');

    expect(DB_ALLOWED_TRANSACTION_STATUSES).toContain(captured.update?.status);
  });

  it('records an ACCEPTED-but-incomplete refund as refund_pending, not refunded', async () => {
    // The buyer does not have the money yet. Calling it `refunded` would be a lie
    // the sweeper could never detect; leaving it `completed` would let a retry
    // settle the order against money that is on its way back.
    const { client, captured } = makeSupabase();

    await markPaypalTransactionRefunded(
      client,
      TXN_ID,
      'duplicate capture (refund PENDING at PayPal)',
      { pending: true }
    );

    expect(captured.update).toMatchObject({ status: 'refund_pending' });
    expect(DB_ALLOWED_TRANSACTION_STATUSES).toContain(captured.update?.status);
  });

  it('persists pending PayPal refund ids so the reconciliation cron can poll them', async () => {
    const { client, captured } = makeSupabase();
    const markWithRefundIds = markPaypalTransactionRefunded as unknown as (
      supabase: SupabaseClient,
      transactionId: string,
      reason: string,
      options: { pending: boolean; pendingRefundIds: string[] }
    ) => Promise<void>;

    await markWithRefundIds(client, TXN_ID, 'refund pending', {
      pending: true,
      pendingRefundIds: ['REFUND-P'],
    });

    expect(captured.update).toMatchObject({
      status: 'refund_pending',
      metadata: {
        existing: true,
        paypal_pending_refund_ids: ['REFUND-P'],
      },
    });
  });

  it('only advances a pending/completed row — never walks a terminal row backwards', async () => {
    const { client, captured } = makeSupabase();

    await markPaypalTransactionRefunded(client, TXN_ID, 'stale amount');

    expect(captured.inStatuses).toEqual(['pending', 'completed']);
  });

  it('falls back to the service client when the caller has none', async () => {
    const { client, captured } = makeSupabase();
    vi.mocked(createServiceClient).mockReturnValue(client as never);

    await markPaypalTransactionRefunded(undefined, TXN_ID, 'verify duplicate');

    expect(createServiceClient).toHaveBeenCalledTimes(1);
    expect(captured.update).toMatchObject({ status: 'refunded' });
  });

  it('logs loudly but does NOT throw when the stamp fails — the refund already succeeded', async () => {
    const { client } = makeSupabase({ error: { message: 'boom' } });

    await expect(
      markPaypalTransactionRefunded(client, TXN_ID, 'duplicate capture')
    ).resolves.toBeUndefined();

    // A refunded capture that still looks settleable is the exact state this
    // guard exists to prevent, so the failure must be visible.
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: TXN_ID })
    );
  });

  it('swallows a thrown client error rather than discarding the successful refund', async () => {
    const throwing = {
      from: () => {
        throw new Error('connection reset');
      },
    } as unknown as SupabaseClient;

    await expect(
      markPaypalTransactionRefunded(throwing, TXN_ID, 'mode mismatch')
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: TXN_ID })
    );
  });
});
