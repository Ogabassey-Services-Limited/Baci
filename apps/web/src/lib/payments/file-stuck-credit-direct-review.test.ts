import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import type { Database } from '@/types/supabase';
import { fileStuckCreditDirectReviews } from './file-stuck-credit-direct-review';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  is: vi.fn(),
  maybeSingle: vi.fn(),
  select: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

function createReconciliationReviewClient() {
  const chain = {
    eq: mocks.eq,
    insert: mocks.insert,
    is: mocks.is,
    maybeSingle: mocks.maybeSingle,
    select: mocks.select,
  };
  mocks.eq.mockReturnValue(chain);
  mocks.is.mockReturnValue(chain);
  mocks.select.mockReturnValue(chain);

  mocks.from.mockImplementation((table: string) => {
    if (table !== 'reconciliation_review') {
      throw new Error(`Unexpected table: ${table}`);
    }
    return chain;
  });

  return { from: mocks.from } as unknown as Pick<
    SupabaseClient<Database>,
    'from'
  >;
}

function stuckCreditDirectOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    merchant_id: 'merchant-1',
    notes: JSON.stringify({
      creditDirectSessionId: 'session-1',
      creditDirectTransactionId: 'transaction-1',
      creditDirectSignedAt: '2026-07-01T00:00:00.000Z',
    }),
    payment_method: 'credit_direct',
    payment_status: 'bnpl_pending',
    total: 100000,
    updated_at: '2026-07-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('fileStuckCreditDirectReview', () => {
  let reviewClient: ReturnType<typeof createReconciliationReviewClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    reviewClient = createReconciliationReviewClient();
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error('helper must not construct admin authority');
    });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.maybeSingle.mockResolvedValue({
      data: { id: 'review-1' },
      error: null,
    });
  });

  it('uses the injected reconciliation client without constructing admin authority', async () => {
    await expect(
      fileStuckCreditDirectReviews(reviewClient, [stuckCreditDirectOrder()])
    ).resolves.toEqual([]);

    expect(mocks.from).toHaveBeenCalledWith('reconciliation_review');
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('labels cron-detected reviews so they cannot masquerade as SDK success', async () => {
    await expect(
      fileStuckCreditDirectReviews(reviewClient, [stuckCreditDirectOrder()])
    ).resolves.toEqual([]);

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: 'credit_direct_stuck_cron',
        }),
      })
    );
  });

  it('treats an existing open review as a successful idempotent filing', async () => {
    mocks.insert.mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value' },
    });

    await expect(
      fileStuckCreditDirectReviews(reviewClient, [stuckCreditDirectOrder()])
    ).resolves.toEqual([]);
    expect(mocks.select).toHaveBeenCalledWith('id');
    expect(mocks.eq).toHaveBeenCalledWith(
      'issue_type',
      'credit_direct_confirmation_missing'
    );
    expect(mocks.eq).toHaveBeenCalledWith('order_id', 'order-1');
    expect(mocks.is).toHaveBeenCalledWith('resolved_at', null);
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'credit_direct_confirmation_missing reconciliation already filed (expected retry no-op)',
        orderId: 'order-1',
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('fails closed when a unique violation does not belong to this order', async () => {
    const error = { code: '23505', message: 'provider reference collision' };
    mocks.insert.mockResolvedValue({ error });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      fileStuckCreditDirectReviews(reviewClient, [stuckCreditDirectOrder()])
    ).resolves.toEqual(['order-1']);
    expect(logger.error).toHaveBeenCalledWith({
      error,
      lookupError: null,
      message:
        'Credit Direct reconciliation insert conflicted without an existing open review for this order',
      orderId: 'order-1',
      providerReference: 'transaction-1',
    });
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('reports a non-duplicate insert failure without claiming the review was filed', async () => {
    const error = { code: 'XX000', message: 'database unavailable' };
    mocks.insert.mockResolvedValue({ error });

    await expect(
      fileStuckCreditDirectReviews(reviewClient, [stuckCreditDirectOrder()])
    ).resolves.toEqual(['order-1']);
    expect(logger.error).toHaveBeenCalledWith({
      error,
      message: 'Failed to file stuck Credit Direct reconciliation review',
      orderId: 'order-1',
      providerReference: 'transaction-1',
    });
  });

  it('contains thrown admin-client failures so the cron can keep alerting', async () => {
    const error = new Error('connection reset');
    mocks.insert.mockRejectedValue(error);

    await expect(
      fileStuckCreditDirectReviews(reviewClient, [stuckCreditDirectOrder()])
    ).resolves.toEqual(['order-1']);
    expect(logger.error).toHaveBeenCalledWith({
      error,
      message:
        'Failed to file stuck Credit Direct reconciliation review (threw)',
      orderId: 'order-1',
      providerReference: 'transaction-1',
    });
  });
});
