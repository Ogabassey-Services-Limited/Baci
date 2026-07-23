import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRpc, mockWarn } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: (...args: unknown[]) => mockWarn(...args) },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
}));

import { releaseWalletCreditPush } from './release-wallet-credit-push';

const input = {
  claimToken: 'claim-token-1',
  reference: 'WAL-123',
  transactionId: 'transaction-1',
};

describe('releaseWalletCreditPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('releases the transaction marker after a retryable delivery failure', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });

    await expect(releaseWalletCreditPush(input)).resolves.toEqual({
      status: 'released',
    });
    expect(mockRpc).toHaveBeenCalledWith('release_wallet_credit_push', {
      p_claim_token: 'claim-token-1',
      p_transaction_id: 'transaction-1',
    });
  });

  it('reports an RPC failure without throwing onto the payment path', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(releaseWalletCreditPush(input)).resolves.toEqual({
      error: 'database unavailable',
      status: 'error',
    });
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'database unavailable' })
    );
  });

  it('reports when no claim marker remained to release', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });

    await expect(releaseWalletCreditPush(input)).resolves.toEqual({
      status: 'not_claimed',
    });
    expect(mockRpc).toHaveBeenCalledWith('release_wallet_credit_push', {
      p_claim_token: 'claim-token-1',
      p_transaction_id: 'transaction-1',
    });
  });

  it('converts a rejected RPC into an error result', async () => {
    mockRpc.mockRejectedValue(new Error('connection reset'));

    await expect(releaseWalletCreditPush(input)).resolves.toEqual({
      error: 'connection reset',
      status: 'error',
    });
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'connection reset' })
    );
  });
});
