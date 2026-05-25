import { describe, expect, it, vi } from 'vitest';
import {
  createSavingsAutoDebitTransaction,
  markSavingsAutoDebitContributionFailed,
} from './customer-savings-auto-debit-db';
import type { SavingsAutoDebitDatabaseClient } from './customer-savings-auto-debit-types';

const baseGoal = {
  contribution_amount: '20000',
  contribution_frequency: 'daily' as const,
  current_amount: '100000',
  customer_id: 'customer-1',
  id: 'goal-1',
  maturity_date: '2026-06-30',
  merchant_id: 'merchant-1',
  preferred_debit_time: '06:20:00',
  saved_payment_method_id: 'payment-method-1',
  start_date: '2026-05-20',
  target_amount: '800000',
};

describe('createSavingsAutoDebitTransaction', () => {
  it('persists the deterministic reference and savings metadata', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: { id: 'txn-1' },
      error: null,
    });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: insertSingle }),
    });
    const supabase = {
      from: vi.fn().mockReturnValue({ insert }),
      rpc: vi.fn(),
    };

    const id = await createSavingsAutoDebitTransaction({
      amount: 20000,
      goal: baseGoal,
      idempotencyKey: 'savings:goal-1:2026-05-21',
      nowIso: '2026-05-21T07:30:00.000Z',
      periodKey: '2026-05-21',
      reference: 'SVG-goal1-2026-05-21',
      supabase: supabase as unknown as SavingsAutoDebitDatabaseClient,
    });

    expect(id).toBe('txn-1');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        gateway_reference: 'SVG-goal1-2026-05-21',
        metadata: expect.objectContaining({
          idempotency_key: 'savings:goal-1:2026-05-21',
          transaction_type: 'savings_auto_debit',
        }),
      })
    );
  });

  it('throws when the transaction insert returns a database error', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: insertSingle }),
    });
    const supabase = {
      from: vi.fn().mockReturnValue({ insert }),
      rpc: vi.fn(),
    };

    await expect(
      createSavingsAutoDebitTransaction({
        amount: 20000,
        goal: baseGoal,
        idempotencyKey: 'savings:goal-1:2026-05-21',
        nowIso: '2026-05-21T07:30:00.000Z',
        periodKey: '2026-05-21',
        reference: 'SVG-goal1-2026-05-21',
        supabase: supabase as unknown as SavingsAutoDebitDatabaseClient,
      })
    ).rejects.toThrow('Database error');
  });

  it('throws when the transaction insert returns no row', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: insertSingle }),
    });
    const supabase = {
      from: vi.fn().mockReturnValue({ insert }),
      rpc: vi.fn(),
    };

    await expect(
      createSavingsAutoDebitTransaction({
        amount: 20000,
        goal: baseGoal,
        idempotencyKey: 'savings:goal-1:2026-05-21',
        nowIso: '2026-05-21T07:30:00.000Z',
        periodKey: '2026-05-21',
        reference: 'SVG-goal1-2026-05-21',
        supabase: supabase as unknown as SavingsAutoDebitDatabaseClient,
      })
    ).rejects.toThrow('Failed to create savings transaction');
  });

  it('throws when the transaction insert returns a malformed row', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: { id: null },
      error: null,
    });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: insertSingle }),
    });
    const supabase = {
      from: vi.fn().mockReturnValue({ insert }),
      rpc: vi.fn(),
    };

    await expect(
      createSavingsAutoDebitTransaction({
        amount: 20000,
        goal: baseGoal,
        idempotencyKey: 'savings:goal-1:2026-05-21',
        nowIso: '2026-05-21T07:30:00.000Z',
        periodKey: '2026-05-21',
        reference: 'SVG-goal1-2026-05-21',
        supabase: supabase as unknown as SavingsAutoDebitDatabaseClient,
      })
    ).rejects.toThrow('Savings transaction insert did not return a valid id');
  });
});

describe('markSavingsAutoDebitContributionFailed', () => {
  it('marks a contribution failed with failure context', async () => {
    const eq = vi.fn().mockResolvedValue({ data: null, error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const supabase = {
      from: vi.fn().mockReturnValue({ update }),
      rpc: vi.fn(),
    };

    await markSavingsAutoDebitContributionFailed(
      supabase as unknown as SavingsAutoDebitDatabaseClient,
      'contribution-1',
      'Card declined',
      '2026-05-21T07:30:00.000Z'
    );

    expect(supabase.from).toHaveBeenCalledWith(
      'customer_savings_contributions'
    );
    expect(update).toHaveBeenCalledWith({
      failed_at: '2026-05-21T07:30:00.000Z',
      failure_reason: 'Card declined',
      status: 'failed',
      updated_at: '2026-05-21T07:30:00.000Z',
    });
    expect(eq).toHaveBeenCalledWith('id', 'contribution-1');
  });

  it('throws when marking a contribution failed does not persist', async () => {
    const eq = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'Update failed' } });
    const update = vi.fn().mockReturnValue({ eq });
    const supabase = {
      from: vi.fn().mockReturnValue({ update }),
      rpc: vi.fn(),
    };

    await expect(
      markSavingsAutoDebitContributionFailed(
        supabase as unknown as SavingsAutoDebitDatabaseClient,
        'contribution-1',
        'Card declined',
        '2026-05-21T07:30:00.000Z'
      )
    ).rejects.toThrow(
      'Failed to mark savings contribution contribution-1 as failed: Update failed'
    );
  });
});
