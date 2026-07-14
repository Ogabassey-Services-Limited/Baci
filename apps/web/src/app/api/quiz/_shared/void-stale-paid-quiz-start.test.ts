import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/admin';
import { voidStalePaidQuizStart } from './void-stale-paid-quiz-start';

vi.mock('@/lib/supabase/admin', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const ATTEMPT_ID = 'attempt-1';
const CUSTOMER_ID = 'customer-1';

type AdminStubOptions = {
  attempt?: { id: string; customer_id: string } | null;
  attemptError?: unknown;
  customer?: { id: string; loyalty_points: number | null } | null;
  customerError?: unknown;
  deleteError?: unknown;
  refundError?: unknown;
};

function mockAdmin(options: AdminStubOptions = {}) {
  const {
    attempt = { customer_id: CUSTOMER_ID, id: ATTEMPT_ID },
    attemptError = null,
    customer = { id: CUSTOMER_ID, loyalty_points: 4 },
    customerError = null,
    deleteError = null,
    refundError = null,
  } = options;

  const update = vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ error: refundError })),
  }));
  const del = vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ error: deleteError })),
  }));

  const from = vi.fn((table: string) => ({
    delete: del,
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(() =>
          Promise.resolve(
            table === 'quiz_attempts'
              ? { data: attempt, error: attemptError }
              : { data: customer, error: customerError }
          )
        ),
      })),
    })),
    update,
  }));

  vi.mocked(createClient).mockReturnValue({
    from,
  } as unknown as ReturnType<typeof createClient>);

  return { del, from, update };
}

describe('voidStalePaidQuizStart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refunds the debited points and voids the attempt', async () => {
    const { del, update } = mockAdmin();

    const result = await voidStalePaidQuizStart({
      attemptId: ATTEMPT_ID,
      pointsSpent: 1,
    });

    expect(result).toEqual({ refunded: true, voided: true });
    // Refund restores the pre-charge balance: 4 remaining + 1 debited.
    expect(update).toHaveBeenCalledWith({ loyalty_points: 5 });
    expect(del).toHaveBeenCalled();
  });

  it('treats a null loyalty balance as zero when refunding', async () => {
    const { update } = mockAdmin({
      customer: { id: CUSTOMER_ID, loyalty_points: null },
    });

    await voidStalePaidQuizStart({ attemptId: ATTEMPT_ID, pointsSpent: 2 });

    expect(update).toHaveBeenCalledWith({ loyalty_points: 2 });
  });

  it('reports the unrefunded charge when there is no attempt id to repair', async () => {
    const result = await voidStalePaidQuizStart({
      attemptId: null,
      pointsSpent: 1,
    });

    expect(result).toEqual({ refunded: false, voided: false });
    expect(createClient).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'quiz_stale_paid_start_void' })
    );
  });

  it('does not report a refund when the attempt row is unreadable', async () => {
    mockAdmin({ attempt: null });

    const result = await voidStalePaidQuizStart({
      attemptId: ATTEMPT_ID,
      pointsSpent: 1,
    });

    expect(result).toEqual({ refunded: false, voided: false });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'quiz_stale_paid_start_void' })
    );
  });

  it('still voids the attempt when the refund write fails', async () => {
    mockAdmin({ refundError: { message: 'refund failed' } });

    const result = await voidStalePaidQuizStart({
      attemptId: ATTEMPT_ID,
      pointsSpent: 1,
    });

    expect(result).toEqual({ refunded: false, voided: true });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'quiz_stale_paid_start_void' })
    );
  });

  it('reports the refund even when the attempt delete fails', async () => {
    mockAdmin({ deleteError: { message: 'delete failed' } });

    const result = await voidStalePaidQuizStart({
      attemptId: ATTEMPT_ID,
      pointsSpent: 1,
    });

    expect(result).toEqual({ refunded: true, voided: false });
  });

  it('never throws when the admin client blows up', async () => {
    vi.mocked(createClient).mockImplementation(() => {
      throw new Error('no service role key');
    });

    const result = await voidStalePaidQuizStart({
      attemptId: ATTEMPT_ID,
      pointsSpent: 1,
    });

    expect(result).toEqual({ refunded: false, voided: false });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'quiz_stale_paid_start_void' })
    );
  });
});
