import { describe, expect, it } from 'vitest';
import { normalizeShippingQuoteResponse } from './quote-response';

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
};

describe('normalizeShippingQuoteResponse', () => {
  it('returns quote arrays, session id, and warnings from the API response', () => {
    expect(
      normalizeShippingQuoteResponse({
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

  it('returns safe defaults when quotes.all is missing or malformed', () => {
    expect(
      normalizeShippingQuoteResponse({
        quotes: undefined,
        sessionId: undefined,
        warnings: [123, null, 'usable warning'],
      })
    ).toEqual({
      quotes: [],
      sessionId: '',
      warnings: ['usable warning'],
    });
  });

  it('keeps compatibility with legacy top-level quote arrays', () => {
    expect(normalizeShippingQuoteResponse({ quotes: [shippingQuote] })).toEqual(
      {
        quotes: [shippingQuote],
        sessionId: '',
        warnings: [],
      }
    );
  });
});
