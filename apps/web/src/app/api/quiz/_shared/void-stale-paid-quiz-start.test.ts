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

type UpdateCall = { values: Record<string, unknown>; guard: string };

type AdminStubOptions = {
  attempt?: { id: string; customer_id: string } | null;
  attemptError?: unknown;
  /** Balance returned by each successive read (last value repeats). */
  balances?: (number | null)[];
  customer?: { id: string; loyalty_points: number | null } | null;
  customerError?: unknown;
  deleteError?: unknown;
  refundError?: unknown;
  /** Rows matched by each successive compare-and-swap (last value repeats). */
  casMatches?: boolean[];
};

function mockAdmin(options: AdminStubOptions = {}) {
  const {
    attempt = { customer_id: CUSTOMER_ID, id: ATTEMPT_ID },
    attemptError = null,
    balances,
    customer = { id: CUSTOMER_ID, loyalty_points: 4 },
    customerError = null,
    deleteError = null,
    refundError = null,
    casMatches = [true],
  } = options;

  const updateCalls: UpdateCall[] = [];
  let readIndex = 0;
  let casIndex = 0;

  function nextBalance(): number | null {
    if (!balances) return customer ? customer.loyalty_points : null;
    const value = balances[Math.min(readIndex, balances.length - 1)] ?? null;
    readIndex += 1;
    return value;
  }

  function nextCasMatch(): boolean {
    const value = casMatches[Math.min(casIndex, casMatches.length - 1)] ?? true;
    casIndex += 1;
    return value;
  }

  const del = vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ error: deleteError })),
  }));

  const update = vi.fn((values: Record<string, unknown>) => {
    const call: UpdateCall = { guard: '', values };
    updateCalls.push(call);

    const chain = {
      eq: vi.fn((column: string) => {
        if (column === 'loyalty_points') call.guard = 'eq';
        return chain;
      }),
      is: vi.fn((column: string) => {
        if (column === 'loyalty_points') call.guard = 'is';
        return chain;
      }),
      select: vi.fn(() =>
        Promise.resolve({
          data: refundError
            ? null
            : nextCasMatch()
              ? [{ id: CUSTOMER_ID }]
              : [],
          error: refundError,
        })
      ),
    };
    return chain;
  });

  const from = vi.fn((table: string) => ({
    delete: del,
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(() => {
          if (table === 'quiz_attempts') {
            return Promise.resolve({ data: attempt, error: attemptError });
          }
          if (customerError || !customer) {
            return Promise.resolve({ data: customer, error: customerError });
          }
          return Promise.resolve({
            data: { id: CUSTOMER_ID, loyalty_points: nextBalance() },
            error: null,
          });
        }),
      })),
    })),
    update,
  }));

  vi.mocked(createClient).mockReturnValue({
    from,
  } as unknown as ReturnType<typeof createClient>);

  return { del, from, update, updateCalls };
}

describe('voidStalePaidQuizStart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refunds the debited points and voids the attempt', async () => {
    const { del, updateCalls } = mockAdmin();

    const result = await voidStalePaidQuizStart({
      attemptId: ATTEMPT_ID,
      pointsSpent: 1,
    });

    expect(result).toEqual({ refunded: true, voided: true });
    // Refund restores the pre-charge balance: 4 remaining + 1 debited.
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.values).toEqual({ loyalty_points: 5 });
    expect(del).toHaveBeenCalled();
  });

  // A blind write would clobber a concurrent redemption or purchase award.
  it('guards the refund on the balance it read, so a concurrent write cannot be lost', async () => {
    const { updateCalls } = mockAdmin();

    await voidStalePaidQuizStart({ attemptId: ATTEMPT_ID, pointsSpent: 1 });

    expect(updateCalls[0]?.guard).toBe('eq');
  });

  it('retries the refund when it loses the compare-and-swap race', async () => {
    // First CAS matches no row (someone else moved the balance 4 -> 9), so the
    // helper must re-read and refund against the NEW balance, not the stale one.
    const { updateCalls } = mockAdmin({
      balances: [4, 9],
      casMatches: [false, true],
    });

    const result = await voidStalePaidQuizStart({
      attemptId: ATTEMPT_ID,
      pointsSpent: 1,
    });

    expect(result.refunded).toBe(true);
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0]?.values).toEqual({ loyalty_points: 5 });
    // Re-read the moved balance and add the refund to THAT, not to the stale 4.
    expect(updateCalls[1]?.values).toEqual({ loyalty_points: 10 });
  });

  it('gives up and flags manual repair when the race is lost repeatedly', async () => {
    const { updateCalls } = mockAdmin({ casMatches: [false] });

    const result = await voidStalePaidQuizStart({
      attemptId: ATTEMPT_ID,
      pointsSpent: 1,
    });

    expect(result.refunded).toBe(false);
    expect(updateCalls).toHaveLength(3);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'quiz_stale_paid_start_void',
        message: expect.stringContaining('manual repair'),
      })
    );
  });

  it('matches a null balance with IS NULL and refunds from zero', async () => {
    const { updateCalls } = mockAdmin({
      customer: { id: CUSTOMER_ID, loyalty_points: null },
    });

    await voidStalePaidQuizStart({ attemptId: ATTEMPT_ID, pointsSpent: 2 });

    // `.eq` never matches NULL in SQL, so the guard must use `.is`.
    expect(updateCalls[0]?.guard).toBe('is');
    expect(updateCalls[0]?.values).toEqual({ loyalty_points: 2 });
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

  it('does not report a refund when the customer row is unreadable', async () => {
    mockAdmin({ customer: null });

    const result = await voidStalePaidQuizStart({
      attemptId: ATTEMPT_ID,
      pointsSpent: 1,
    });

    expect(result.refunded).toBe(false);
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
