import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as paypalRefunds from './paypal-refunds';
import { refund } from './paypal-refunds';

const OAUTH_RESPONSE = {
  ok: true,
  json: async () => ({
    scope: 'all',
    access_token: 'A21_mock_token',
    token_type: 'Bearer',
    expires_in: 3600,
  }),
} as Response;

describe('refund', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('issues a full refund when no amount is specified', async () => {
    const mockFetch = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(OAUTH_RESPONSE)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'REFUND_1', status: 'COMPLETED' }),
      } as Response);

    const result = await refund(
      'client123',
      'secret123',
      'CAPTURE_111',
      'sandbox'
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('COMPLETED');
    }

    const refundCall = mockFetch.mock.calls.at(-1);
    expect(refundCall?.[0]).toBe(
      'https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE_111/refund'
    );
    const refundBody = JSON.parse(
      (refundCall?.[1] as RequestInit)?.body as string
    );
    expect(refundBody.amount).toBeUndefined();
  });

  it('issues a partial refund with the supplied amount and currency', async () => {
    const mockFetch = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(OAUTH_RESPONSE)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'REFUND_2',
          status: 'COMPLETED',
          amount: { currency_code: 'USD', value: '5.00' },
        }),
      } as Response);

    const result = await refund(
      'client123',
      'secret123',
      'CAPTURE_111',
      'sandbox',
      {
        amount: 5,
        currency: 'USD',
        noteToPayer: 'Partial refund for damaged item',
      }
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toEqual({
        currency_code: 'USD',
        value: '5.00',
      });
    }

    const refundBody = JSON.parse(
      (mockFetch.mock.calls.at(-1)?.[1] as RequestInit)?.body as string
    );
    expect(refundBody.amount).toEqual({ currency_code: 'USD', value: '5.00' });
    expect(refundBody.note_to_payer).toBe('Partial refund for damaged item');
  });

  it('rejects a partial refund missing a currency', async () => {
    const mockFetch = vi.spyOn(global, 'fetch');

    const result = await refund(
      'client123',
      'secret123',
      'CAPTURE_111',
      'sandbox',
      {
        amount: 5,
      }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('INVALID_AMOUNT');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns a failure when PayPal rejects the refund (e.g. already refunded)', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(OAUTH_RESPONSE)
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'CAPTURE_FULLY_REFUNDED' }),
      } as Response);

    const result = await refund(
      'client123',
      'secret123',
      'CAPTURE_111',
      'sandbox'
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('HTTP_422');
      expect(result.error).toBe('CAPTURE_FULLY_REFUNDED');
    }
  });

  it('propagates an OAuth failure without attempting the refund call', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error_description: 'Client Authentication failed' }),
    } as Response);

    const result = await refund(
      'client123',
      'secret123',
      'CAPTURE_111',
      'sandbox'
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('HTTP_401');
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns a NETWORK_ERROR failure when the refund fetch throws', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(OAUTH_RESPONSE)
      .mockRejectedValueOnce(new Error('ETIMEDOUT'));

    const result = await refund(
      'client123',
      'secret123',
      'CAPTURE_111',
      'sandbox'
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.error).toBe('ETIMEDOUT');
    }
  });

  it('reads a refund resource so pending refunds can be reconciled to completion', async () => {
    const getRefund = (
      paypalRefunds as unknown as {
        getRefund?: (
          clientId: string,
          secretKey: string,
          refundId: string,
          mode: 'sandbox' | 'live'
        ) => Promise<unknown>;
      }
    ).getRefund;
    expect(typeof getRefund).toBe('function');

    const mockFetch = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(OAUTH_RESPONSE)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'REFUND-P', status: 'COMPLETED' }),
      } as Response);

    const result = await getRefund?.(
      'client123',
      'secret123',
      'REFUND-P',
      'live'
    );

    expect(result).toEqual({
      success: true,
      data: { id: 'REFUND-P', status: 'COMPLETED' },
    });
    expect(mockFetch.mock.calls.at(-1)?.[0]).toBe(
      'https://api-m.paypal.com/v2/payments/refunds/REFUND-P'
    );
    expect(mockFetch.mock.calls.at(-1)?.[1]).toMatchObject({ method: 'GET' });
  });
});
