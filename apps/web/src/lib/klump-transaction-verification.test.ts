import { describe, expect, it, vi } from 'vitest';
import {
  getKlumpExpectedPaymentAmount,
  verifyKlumpWebhookTransaction,
} from '@/lib/klump-transaction-verification';
import type { KlumpWebhookDetails } from '@/lib/klump-webhook';

const webhookDetails: KlumpWebhookDetails = {
  amount: 50000,
  currency: 'NGN',
  event: 'klump.payment.transaction.successful',
  isLive: true,
  merchantReference: 'BAC-ABCD12345678',
  transactionId: 'klump-txn-123',
};

const transaction = {
  amount: '50000',
  currency: 'NGN',
};

describe('verifyKlumpWebhookTransaction', () => {
  it('ignores zero merchant_amount when selecting the expected amount', () => {
    expect(
      getKlumpExpectedPaymentAmount({
        amount: '50000',
        merchant_amount: 0,
      })
    ).toBe('50000');
  });

  it('verifies provider transaction details with the Klump secret key header', async () => {
    const fetchSpy = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      Response.json({
        data: {
          amount: 50000,
          currency: 'NGN',
          id: 'klump-txn-123',
          is_live: true,
          merchant_reference: 'BAC-ABCD12345678',
          status: 'successful',
        },
      })
    );

    const result = await verifyKlumpWebhookTransaction({
      details: webhookDetails,
      fetcher: fetchSpy,
      reference: 'BAC-ABCD12345678',
      secretKey: 'klump-secret',
      transaction,
    });

    expect(result).toEqual({ success: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.useklump.com/v1/transactions/klump-txn-123/verify',
      expect.objectContaining({
        headers: expect.objectContaining({
          'klump-secret-key': 'klump-secret',
        }),
        method: 'GET',
      })
    );
  });

  it('fails when Klump does not confirm a successful transaction', async () => {
    const fetchSpy = vi.fn(async () =>
      Response.json({
        data: {
          amount: 50000,
          currency: 'NGN',
          id: 'klump-txn-123',
          is_live: true,
          status: 'pending',
        },
      })
    );

    const result = await verifyKlumpWebhookTransaction({
      details: webhookDetails,
      fetcher: fetchSpy,
      reference: 'BAC-ABCD12345678',
      secretKey: 'klump-secret',
      transaction,
    });

    expect(result).toEqual({
      error: 'Invalid Klump transaction verification response',
      status: 502,
      success: false,
    });
  });

  it('fails when provider verification does not match the stored amount', async () => {
    const fetchSpy = vi.fn(async () =>
      Response.json({
        data: {
          amount: 49000,
          currency: 'NGN',
          id: 'klump-txn-123',
          is_live: true,
          merchant_reference: 'BAC-ABCD12345678',
          status: 'successful',
        },
      })
    );

    const result = await verifyKlumpWebhookTransaction({
      details: webhookDetails,
      fetcher: fetchSpy,
      reference: 'BAC-ABCD12345678',
      secretKey: 'klump-secret',
      transaction,
    });

    expect(result).toEqual({
      error: 'Verified payment amount mismatch',
      status: 400,
      success: false,
    });
  });

  it('uses merchant_amount as the expected Klump charge amount when present', async () => {
    const fetchSpy = vi.fn(async () =>
      Response.json({
        data: {
          amount: 58089,
          currency: 'NGN',
          id: 'klump-txn-123',
          is_live: true,
          merchant_reference: 'BAC-ABCD12345678',
          status: 'successful',
        },
      })
    );

    const result = await verifyKlumpWebhookTransaction({
      details: {
        ...webhookDetails,
        amount: 58089,
      },
      fetcher: fetchSpy,
      reference: 'BAC-ABCD12345678',
      secretKey: 'klump-secret',
      transaction: {
        amount: '58088.5',
        currency: 'NGN',
        merchant_amount: 58089,
      },
    });

    expect(result).toEqual({ success: true });
  });

  it('verifies Klump responses that expose customer charge and original amount separately', async () => {
    const fetchSpy = vi.fn(async () =>
      Response.json({
        data: {
          amount: '694122.50',
          currency: 'NGN',
          id: 'klump-txn-123',
          is_live: true,
          merchant_reference: 'BAC-ABCD12345678',
          original_amount: '687250.00',
          status: 'successful',
        },
        state: 'success',
      })
    );

    const result = await verifyKlumpWebhookTransaction({
      details: {
        ...webhookDetails,
        amount: 687250,
      },
      fetcher: fetchSpy,
      reference: 'BAC-ABCD12345678',
      secretKey: 'klump-secret',
      transaction: {
        amount: '687250',
        currency: 'NGN',
        merchant_amount: 687250,
      },
    });

    expect(result).toEqual({ success: true });
  });

  it('does not treat a successful Klump lookup as a paid transaction', async () => {
    const fetchSpy = vi.fn(async () =>
      Response.json({
        data: {
          amount: '694122.50',
          currency: 'NGN',
          id: 'klump-txn-123',
          is_live: true,
          merchant_reference: 'BAC-ABCD12345678',
          original_amount: '687250.00',
          status: 'new',
        },
        state: 'success',
      })
    );

    const result = await verifyKlumpWebhookTransaction({
      details: {
        ...webhookDetails,
        amount: 687250,
      },
      fetcher: fetchSpy,
      reference: 'BAC-ABCD12345678',
      secretKey: 'klump-secret',
      transaction: {
        amount: '687250',
        currency: 'NGN',
        merchant_amount: 687250,
      },
    });

    expect(result).toEqual({
      error: 'Invalid Klump transaction verification response',
      status: 502,
      success: false,
    });
  });
});
