import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  getKlumpWebhookSecret,
  parseKlumpWebhookPayload,
  verifyKlumpWebhookSignature,
} from './klump-webhook';

function sign(rawBody: string, secret: string) {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

describe('Klump webhook helpers', () => {
  it('trims Klump webhook secrets before selecting the fallback secret', () => {
    expect(
      getKlumpWebhookSecret({
        KLUMP_SECRET_KEY: ' fallback-secret ',
        KLUMP_WEBHOOK_SECRET: '   ',
      })
    ).toBe('fallback-secret');
    expect(
      getKlumpWebhookSecret({
        KLUMP_SECRET_KEY: 'fallback-secret',
        KLUMP_WEBHOOK_SECRET: ' webhook-secret ',
      })
    ).toBe('webhook-secret');
  });

  it('verifies raw-body HMAC signatures with or without a sha256 prefix', () => {
    const rawBody = JSON.stringify({ event: 'klump.payment.successful' });
    const signature = sign(rawBody, 'secret');

    expect(
      verifyKlumpWebhookSignature({
        rawBody,
        secret: 'secret',
        signature,
      })
    ).toBe(true);
    expect(
      verifyKlumpWebhookSignature({
        rawBody,
        secret: 'secret',
        signature: `sha256=${signature}`,
      })
    ).toBe(true);
    expect(
      verifyKlumpWebhookSignature({
        rawBody,
        secret: 'secret',
        signature: 'bad-signature',
      })
    ).toBe(false);
    expect(
      verifyKlumpWebhookSignature({
        rawBody,
        secret: 'secret',
        signature: `${signature}zz`,
      })
    ).toBe(false);
  });

  it('treats initiated events as non-success even when nested status is successful', () => {
    const parsed = parseKlumpWebhookPayload(
      JSON.stringify({
        data: {
          amount: 50000,
          id: 'klump-txn-123',
          merchant_reference: 'BAC-ABCD12345678',
          status: 'successful',
        },
        event: 'klump.payment.transaction.initiated',
      })
    );

    expect(parsed).toEqual({
      details: null,
      payload: expect.any(Object),
      success: true,
    });
  });

  it('treats unsuccessful events as non-success even though they contain success', () => {
    const parsed = parseKlumpWebhookPayload(
      JSON.stringify({
        data: {
          amount: 50000,
          id: 'klump-txn-123',
          merchant_reference: 'BAC-ABCD12345678',
          status: 'successful',
        },
        event: 'klump.payment.transaction.unsuccessful',
      })
    );

    expect(parsed).toEqual({
      details: null,
      payload: expect.any(Object),
      success: true,
    });
  });

  it('extracts successful transaction details from Klump payloads', () => {
    const parsed = parseKlumpWebhookPayload(
      JSON.stringify({
        data: {
          currency: 'NGN',
          is_live: true,
          transaction: {
            amount: '50000',
            id: 'klump-txn-123',
            merchant_reference: 'BAC-ABCD12345678',
          },
        },
        event: 'klump.payment.transaction.successful',
      })
    );

    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.details : null).toEqual({
      amount: 50000,
      currency: 'NGN',
      event: 'klump.payment.transaction.successful',
      isLive: true,
      merchantReference: 'BAC-ABCD12345678',
      transactionId: 'klump-txn-123',
    });
  });
});
