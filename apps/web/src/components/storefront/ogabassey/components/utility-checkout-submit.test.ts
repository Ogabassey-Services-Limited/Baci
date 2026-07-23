import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchWithCsrf = vi.hoisted(() => vi.fn());
const mockRedirect = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: mockFetchWithCsrf,
}));

vi.mock('./utility-checkout', async (importOriginal) => {
  const original = await importOriginal<typeof import('./utility-checkout')>();
  return { ...original, redirectToPaymentCheckout: mockRedirect };
});

import { submitUtilityCheckout } from './utility-checkout-submit';

function jsonResponse(
  body: Record<string, unknown>,
  init: { ok?: boolean; status?: number } = {}
) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

const baseRequest = {
  payload: { amount: 100, type: 'airtime', phoneNumber: '08012345678' },
  merchantSlug: 'ogabassey',
  customerName: 'Test Customer',
  customerPhone: '08012345678',
  getWalletIdempotencyKey: () => 'idem-key',
};

describe('submitUtilityCheckout', () => {
  beforeEach(() => {
    mockFetchWithCsrf.mockReset();
    mockRedirect.mockReset();
  });

  it('routes a fully-covered wallet purchase to wallet-only checkout', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse({ amount: 100, reference: 'REF1', status: 'successful' })
    );

    const result = await submitUtilityCheckout({
      ...baseRequest,
      walletAmount: 100,
    });

    expect(mockFetchWithCsrf).toHaveBeenCalledWith(
      '/api/vtu/checkout/wallet-only',
      expect.objectContaining({
        headers: { 'Idempotency-Key': 'idem-key' },
      })
    );
    expect(result).toEqual({
      kind: 'wallet-success',
      reference: 'REF1',
      amount: 100,
      processing: false,
    });
  });

  it('redirects a card/partial purchase to the returned checkout url', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse({ checkout_url: 'https://pay.example/checkout' })
    );

    const result = await submitUtilityCheckout({
      ...baseRequest,
      walletAmount: 0,
    });

    expect(mockRedirect).toHaveBeenCalledWith('https://pay.example/checkout');
    expect(result).toEqual({ kind: 'redirected' });
  });

  it('returns an error result when the checkout call fails', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse({ error: 'Insufficient funds' }, { ok: false, status: 400 })
    );

    const result = await submitUtilityCheckout({
      ...baseRequest,
      walletAmount: 0,
    });

    expect(result).toEqual({ kind: 'error', message: 'Insufficient funds' });
  });

  it('surfaces a status-coded error for a failed non-JSON response', async () => {
    mockFetchWithCsrf.mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('<html>Bad gateway</html>'),
    } as Response);

    const result = await submitUtilityCheckout({
      ...baseRequest,
      walletAmount: 0,
    });

    expect(result).toEqual({
      kind: 'error',
      message: 'Payment checkout failed (502)',
    });
  });
});
