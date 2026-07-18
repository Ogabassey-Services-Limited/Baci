import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eqIssue: vi.fn(),
  eqOrder: vi.fn(),
  isOpen: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.loggerError },
}));

import { resolveCreditDirectConfirmationReview } from './resolve-credit-direct-confirmation-review';

describe('resolveCreditDirectConfirmationReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAdminClient.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue({ update: mocks.update });
    mocks.update.mockReturnValue({ eq: mocks.eqIssue });
    mocks.eqIssue.mockReturnValue({ eq: mocks.eqOrder });
    mocks.eqOrder.mockReturnValue({ is: mocks.isOpen });
    mocks.isOpen.mockResolvedValue({ error: null });
  });

  it('resolves only the open missing-confirmation review for the order', async () => {
    await expect(
      resolveCreditDirectConfirmationReview({
        orderId: 'order-1',
        providerReference: 'cd-1',
      })
    ).resolves.toBe(true);

    expect(mocks.from).toHaveBeenCalledWith('reconciliation_review');
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution_notes: expect.stringContaining('cd-1'),
        resolved_at: expect.any(String),
      })
    );
    expect(mocks.eqIssue).toHaveBeenCalledWith(
      'issue_type',
      'credit_direct_confirmation_missing'
    );
    expect(mocks.eqOrder).toHaveBeenCalledWith('order_id', 'order-1');
    expect(mocks.isOpen).toHaveBeenCalledWith('resolved_at', null);
  });

  it('fails closed for callers when the review cannot be resolved', async () => {
    mocks.isOpen.mockResolvedValue({ error: { message: 'database down' } });

    await expect(
      resolveCreditDirectConfirmationReview({
        orderId: 'order-1',
        providerReference: 'cd-1',
      })
    ).resolves.toBe(false);

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to resolve Credit Direct confirmation review',
        orderId: 'order-1',
      })
    );
  });
});
