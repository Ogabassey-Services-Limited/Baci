import { describe, expect, it } from 'vitest';
import {
  API_URL,
  getPaymentInitializationErrorMessage,
  normalizeDomainSearchResults,
} from './domain-api-helpers';

describe('domain-api-helpers', () => {
  it('builds the production API url once', () => {
    expect(API_URL).toBe('https://usebaci.com/api');
  });

  it('formats payment initialization errors from json bodies', () => {
    const response = new Response(null, { status: 500 });

    expect(
      getPaymentInitializationErrorMessage(
        response,
        JSON.stringify({ error: 'Gateway down' })
      )
    ).toBe('Payment initialization failed (500): Gateway down');
  });

  it('falls back to the raw body when the error body is not json', () => {
    const response = new Response(null, { status: 502 });

    expect(
      getPaymentInitializationErrorMessage(response, 'Upstream timeout')
    ).toBe('Payment initialization failed (502): Upstream timeout');
  });

  it('returns the fallback message when the error body is empty', () => {
    const response = new Response(null, { status: 503 });

    expect(getPaymentInitializationErrorMessage(response, '')).toBe(
      'Payment initialization failed (503)'
    );
  });

  it('normalizes domain results to the explicit default currency when it is missing', () => {
    expect(
      normalizeDomainSearchResults(
        [
          {
            available: true,
            currency: '  ',
            domain: 'baci.com',
            popular: true,
            price: 25000,
          },
        ],
        'USD'
      )
    ).toEqual([
      {
        available: true,
        currency: 'USD',
        domain: 'baci.com',
        popular: true,
        price: 25000,
      },
    ]);
  });

  it('preserves non-empty currencies during normalization', () => {
    expect(
      normalizeDomainSearchResults(
        [
          {
            available: true,
            currency: 'EUR',
            domain: 'baci.com',
            popular: false,
            price: 25000,
          },
        ],
        'NGN'
      )
    ).toEqual([
      {
        available: true,
        currency: 'EUR',
        domain: 'baci.com',
        popular: false,
        price: 25000,
      },
    ]);
  });
});
