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
  };

  return {
    client: { from: () => builder } as unknown as SupabaseClient,
    captured,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('markPaypalTransactionRefunded', () => {
  it('stamps the refunded transaction so no later path can settle against it', async () => {
    const { client, captured } = makeSupabase();

    await markPaypalTransactionRefunded(client, TXN_ID, 'duplicate capture');

    expect(captured.update).toMatchObject({ status: 'refunded' });
    expect(captured.eqId).toBe(TXN_ID);
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
