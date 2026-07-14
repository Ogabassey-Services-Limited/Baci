import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRpc, mockWarn } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: (...args: unknown[]) => mockWarn(...args) },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mockRpc,
  }),
}));

import { claimWalletCreditPush } from './claim-wallet-credit-push';

const input = {
  claimToken: 'claim-token-1',
  reference: 'WAL-123',
  transactionId: 'transaction-1',
};

describe('claimWalletCreditPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true only for the caller that updates the transaction', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });

    await expect(claimWalletCreditPush(input)).resolves.toEqual({
      status: 'claimed',
    });
    expect(mockRpc).toHaveBeenCalledWith('claim_wallet_credit_push_v2', {
      p_claim_token: 'claim-token-1',
      p_transaction_id: 'transaction-1',
    });
  });

  it('returns false when another caller already claimed the push', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });

    await expect(claimWalletCreditPush(input)).resolves.toEqual({
      status: 'already_claimed',
    });
  });

  it('fails closed when the claim query errors', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(claimWalletCreditPush(input)).resolves.toEqual({
      error: 'database unavailable',
      status: 'error',
    });
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'database unavailable' })
    );
  });

  it('distinguishes a rejected query from claim contention', async () => {
    mockRpc.mockRejectedValueOnce(new Error('connection reset'));

    await expect(claimWalletCreditPush(input)).resolves.toEqual({
      error: 'connection reset',
      status: 'error',
    });
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'connection reset' })
    );
  });
});
