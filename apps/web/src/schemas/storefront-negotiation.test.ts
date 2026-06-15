import { describe, expect, it } from 'vitest';
import { storefrontNegotiationSchema } from './storefront-negotiation';

const validPayload = {
  productId: '11111111-1111-4111-8111-111111111111',
  merchantId: '22222222-2222-4222-8222-222222222222',
  offeredPrice: 98000,
};

describe('storefrontNegotiationSchema', () => {
  it('parses valid negotiation requests and defaults the attempt number', () => {
    expect(storefrontNegotiationSchema.parse(validPayload)).toEqual({
      ...validPayload,
      attemptNumber: 1,
    });
  });

  it('accepts optional customer and evidence fields', () => {
    expect(
      storefrontNegotiationSchema.parse({
        ...validPayload,
        attemptNumber: 3,
        customerEmail: 'ada@example.com',
        customerPhone: '08012345678',
        evidenceUrl: 'https://example.com/evidence.png',
        evidenceNote: 'Merchant competitor screenshot',
      })
    ).toMatchObject({
      attemptNumber: 3,
      customerEmail: 'ada@example.com',
      customerPhone: '08012345678',
      evidenceUrl: 'https://example.com/evidence.png',
      evidenceNote: 'Merchant competitor screenshot',
    });
  });

  it('rejects invalid identifiers, non-positive offers, and out-of-range attempts', () => {
    expect(() =>
      storefrontNegotiationSchema.parse({
        productId: 'not-a-uuid',
        merchantId: validPayload.merchantId,
        offeredPrice: 0,
        attemptNumber: 4,
      })
    ).toThrow();
  });
});
