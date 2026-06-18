import { describe, expect, it } from 'vitest';
import {
  normalizeShippingQuoteResponsePayload,
  shippingQuoteApiResponseSchema,
} from './shipping-quote-response';

const shippingQuote = {
  id: 'quote-1',
  provider: 'GIGL',
  serviceTier: 'standard',
  carrierName: 'GIG Logistics',
  displayName: 'GIG Logistics',
  estimatedDays: 2,
  price: 2500,
  currency: 'NGN',
  pickupIncluded: false,
  insuranceIncluded: true,
} as const;

describe('shippingQuoteApiResponseSchema', () => {
  it('parses the nested quote response envelope', () => {
    expect(
      normalizeShippingQuoteResponsePayload({
        quotes: { featured: [shippingQuote], all: [shippingQuote] },
        sessionId: 'session-1',
        warnings: ['Address was normalized'],
      })
    ).toEqual({
      quotes: [shippingQuote],
      sessionId: 'session-1',
      warnings: ['Address was normalized'],
    });
  });

  it('keeps legacy top-level quote arrays', () => {
    expect(
      normalizeShippingQuoteResponsePayload({ quotes: [shippingQuote] })
    ).toEqual({
      quotes: [shippingQuote],
      sessionId: '',
      warnings: [],
    });
  });

  it('filters malformed quotes and warning values', () => {
    expect(
      normalizeShippingQuoteResponsePayload({
        quotes: { all: [{ id: 123 }, shippingQuote] },
        sessionId: 123,
        warnings: [null, '', 'usable warning'],
      })
    ).toEqual({
      quotes: [shippingQuote],
      sessionId: '',
      warnings: ['', 'usable warning'],
    });
  });

  it('returns defaults for non-object responses', () => {
    expect(normalizeShippingQuoteResponsePayload(null)).toEqual({
      quotes: [],
      sessionId: '',
      warnings: [],
    });
  });

  it('exposes a safeParse schema for direct boundary validation', () => {
    expect(
      shippingQuoteApiResponseSchema.safeParse({
        quotes: { all: [shippingQuote] },
      }).success
    ).toBe(true);
  });
});
