import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getPrivateKey,
  getPublicKey,
  getWebhookSecret,
  normalizeCreditDirectEnvValue,
  parseWebhookPayload,
  verifyWebhookSignature,
} from '@/lib/credit-direct';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('verifyWebhookSignature', () => {
  const payload = JSON.stringify({ event: 'payment.completed', id: 'evt_123' });
  const secretBytes = crypto.randomBytes(32);
  const secret = `whsec_${secretBytes.toString('base64')}`;
  const svixId = 'msg_123';
  const nowTimestampSeconds = 1_700_000_000;
  const svixTimestamp = String(nowTimestampSeconds);

  function signPayload(rawBody: string, timestamp = svixTimestamp) {
    const signedContent = `${svixId}.${timestamp}.${rawBody}`;
    const signature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64');
    return `v1,${signature}`;
  }

  it('returns true for a valid Svix-style webhook signature', () => {
    expect(
      verifyWebhookSignature({
        rawBody: payload,
        secret,
        svixId,
        svixTimestamp,
        svixSignature: signPayload(payload),
        nowTimestampSeconds,
      })
    ).toBe(true);
  });

  it('returns false instead of throwing when required Svix headers are missing', () => {
    expect(() =>
      verifyWebhookSignature({
        rawBody: payload,
        secret,
        svixId: null,
        svixTimestamp,
        svixSignature: signPayload(payload),
        nowTimestampSeconds,
      })
    ).not.toThrow();
    expect(
      verifyWebhookSignature({
        rawBody: payload,
        secret,
        svixId: null,
        svixTimestamp,
        svixSignature: signPayload(payload),
        nowTimestampSeconds,
      })
    ).toBe(false);
  });

  it('returns false for an empty signature', () => {
    expect(
      verifyWebhookSignature({
        rawBody: payload,
        secret,
        svixId,
        svixTimestamp,
        svixSignature: '',
        nowTimestampSeconds,
      })
    ).toBe(false);
  });

  it('returns false for an incorrect signature with the expected length', () => {
    const invalidSignature = `v1,${Buffer.from(crypto.randomBytes(32)).toString(
      'base64'
    )}`;

    expect(
      verifyWebhookSignature({
        rawBody: payload,
        secret,
        svixId,
        svixTimestamp,
        svixSignature: invalidSignature,
        nowTimestampSeconds,
      })
    ).toBe(false);
  });

  it('returns false for a stale timestamp', () => {
    const staleTimestamp = String(nowTimestampSeconds - 301);

    expect(
      verifyWebhookSignature({
        rawBody: payload,
        secret,
        svixId,
        svixTimestamp: staleTimestamp,
        svixSignature: signPayload(payload, staleTimestamp),
        nowTimestampSeconds,
      })
    ).toBe(false);
  });

  it('returns false for a future timestamp outside tolerance', () => {
    const futureTimestamp = String(nowTimestampSeconds + 301);

    expect(
      verifyWebhookSignature({
        rawBody: payload,
        secret,
        svixId,
        svixTimestamp: futureTimestamp,
        svixSignature: signPayload(payload, futureTimestamp),
        nowTimestampSeconds,
      })
    ).toBe(false);
  });

  it('accepts a matching signature from a space-delimited signature list', () => {
    const invalidSignature = Buffer.from(crypto.randomBytes(32)).toString(
      'base64'
    );

    expect(
      verifyWebhookSignature({
        rawBody: payload,
        secret,
        svixId,
        svixTimestamp,
        svixSignature: `v1,${invalidSignature} ${signPayload(payload)}`,
        nowTimestampSeconds,
      })
    ).toBe(true);
  });
});

describe('Credit Direct environment helpers', () => {
  it('preserves clean values without edge newlines', () => {
    expect(normalizeCreditDirectEnvValue('clean-private-key')).toBe(
      'clean-private-key'
    );
    expect(normalizeCreditDirectEnvValue('another-clean-value-123')).toBe(
      'another-clean-value-123'
    );
  });

  it('normalizes escaped trailing newlines followed by whitespace', () => {
    vi.stubEnv('CREDIT_DIRECT_PRIVATE_KEY', 'private-key\\n   ');
    vi.stubEnv('CREDIT_DIRECT_PUBLIC_KEY', 'public-key\\n   ');
    vi.stubEnv('CREDIT_DIRECT_WEBHOOK_SECRET', 'webhook-secret\\n   ');

    expect(getPrivateKey()).toBe('private-key');
    expect(getPublicKey()).toBe('public-key');
    expect(getWebhookSecret()).toBe('webhook-secret');
  });

  it('normalizes escaped edge newlines with surrounding spaces', () => {
    expect(normalizeCreditDirectEnvValue(' \\n private-key \\n ')).toBe(
      'private-key'
    );
    expect(normalizeCreditDirectEnvValue(' \r\n public-key \r\n ')).toBe(
      'public-key'
    );
  });

  it('normalizes multiple escaped and real edge newlines', () => {
    expect(normalizeCreditDirectEnvValue('key\\n\\n')).toBe('key');
    expect(normalizeCreditDirectEnvValue('key\n\n')).toBe('key');
    expect(normalizeCreditDirectEnvValue('key\\n\n')).toBe('key');
  });

  it('normalizes blank values to an empty string', () => {
    expect(normalizeCreditDirectEnvValue('   ')).toBe('');
    expect(normalizeCreditDirectEnvValue('')).toBe('');
  });
});

describe('parseWebhookPayload', () => {
  const validPayload = {
    checkoutCustomer: {
      firstName: 'Ada',
      lastName: 'Lovelace',
    },
    checkoutTransactionId: 'txn_123',
    eventType: 'Checkout_Merchant_Payment_Completed',
    metaData: 'order_123',
    products: [
      {
        productName: 'Phone',
        productAmount: '30000',
        productId: 'prod_123',
      },
    ],
    timeStamp: '2026-06-30T09:00:00Z',
  } as const;

  it('accepts webhook payloads with string product amounts', () => {
    expect(parseWebhookPayload(validPayload)).toEqual(validPayload);
  });

  it('accepts webhook payloads when metadata is omitted', () => {
    const payloadWithoutMetadata = {
      checkoutCustomer: validPayload.checkoutCustomer,
      checkoutTransactionId: validPayload.checkoutTransactionId,
      eventType: validPayload.eventType,
      products: validPayload.products,
      timeStamp: validPayload.timeStamp,
    };

    expect(parseWebhookPayload(payloadWithoutMetadata)).toEqual({
      ...payloadWithoutMetadata,
      metaData: null,
    });
  });

  it('leaves non-empty string amounts to route-level numeric validation', () => {
    const payload = {
      ...validPayload,
      products: [
        {
          productName: 'Phone',
          productAmount: 'not-a-number',
          productId: 'prod_123',
        },
      ],
    };

    expect(parseWebhookPayload(payload)).toEqual(payload);
  });

  it('rejects missing or non-array products', () => {
    expect(parseWebhookPayload({ ...validPayload, products: undefined })).toBe(
      null
    );
    expect(parseWebhookPayload({ ...validPayload, products: null })).toBe(null);
    expect(parseWebhookPayload({ ...validPayload, products: {} })).toBe(null);
  });

  it('rejects malformed product items', () => {
    expect(
      parseWebhookPayload({
        ...validPayload,
        products: [{ productName: 'Phone', productAmount: 30000 }],
      })
    ).toBe(null);
    expect(
      parseWebhookPayload({
        ...validPayload,
        products: [
          {
            productName: '',
            productAmount: 30000,
            productId: 'prod_123',
          },
        ],
      })
    ).toBe(null);
    expect(
      parseWebhookPayload({
        ...validPayload,
        products: [
          {
            productName: 'Phone',
            productAmount: '',
            productId: 'prod_123',
          },
        ],
      })
    ).toBe(null);
  });
});
