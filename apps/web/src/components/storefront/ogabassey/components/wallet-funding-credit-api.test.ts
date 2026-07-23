import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { walletFundingCreditApi } from './wallet-funding-credit-api';

const mockFetch = vi.fn();

describe('walletFundingCreditApi.poll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the parsed ledger for a successful wallet read', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        balance: 5000,
        transactions: [
          {
            amount: 5000,
            id: 'txn-1',
            source_type: 'wallet_topup',
            type: 'credit',
          },
        ],
      }),
      ok: true,
    });

    const result = await walletFundingCreditApi.poll('ogabassey');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/storefront/customer/wallet?merchant=ogabassey',
      { signal: undefined }
    );
    expect(result).toEqual({
      balance: 5000,
      kind: 'ready',
      transactions: [
        {
          amount: 5000,
          id: 'txn-1',
          source_type: 'wallet_topup',
          type: 'credit',
        },
      ],
    });
  });

  it('encodes the merchant slug', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ transactions: [] }),
      ok: true,
    });

    await walletFundingCreditApi.poll('oga bassey&x');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/storefront/customer/wallet?merchant=oga%20bassey%26x',
      { signal: undefined }
    );
  });

  it('fails closed on a non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => ({}), ok: false });

    await expect(walletFundingCreditApi.poll('ogabassey')).resolves.toEqual({
      kind: 'error',
    });
  });

  it('fails closed on a network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'));

    await expect(walletFundingCreditApi.poll('ogabassey')).resolves.toEqual({
      kind: 'error',
    });
  });

  it('fails closed on a payload that does not match the schema', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ error: 'Unauthorized' }),
      ok: true,
    });

    await expect(walletFundingCreditApi.poll('ogabassey')).resolves.toEqual({
      kind: 'error',
    });
  });
});
