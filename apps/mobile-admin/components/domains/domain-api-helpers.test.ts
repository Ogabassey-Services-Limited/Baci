import { describe, expect, it } from 'vitest';
import {
  API_URL,
  DomainUpgradeRequiredError,
  extractErrorCode,
  getPaymentInitializationErrorMessage,
  isUpgradeRequiredResponse,
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

  describe('isUpgradeRequiredResponse', () => {
    it('treats a 402 as a plan gate regardless of code', () => {
      expect(isUpgradeRequiredResponse(402)).toBe(true);
    });

    it('treats an explicit requires_upgrade code as a plan gate', () => {
      expect(isUpgradeRequiredResponse(403, 'requires_upgrade')).toBe(true);
    });

    it('does not treat genuine failures as plan gates', () => {
      expect(isUpgradeRequiredResponse(500)).toBe(false);
      expect(isUpgradeRequiredResponse(400, 'invalid_input')).toBe(false);
      expect(isUpgradeRequiredResponse(503, null)).toBe(false);
    });
  });

  describe('extractErrorCode', () => {
    it('reads the code from a JSON error body', () => {
      expect(
        extractErrorCode(
          JSON.stringify({ code: 'requires_upgrade', error: 'x' })
        )
      ).toBe('requires_upgrade');
    });

    it('returns undefined for empty, non-JSON, or code-less bodies', () => {
      expect(extractErrorCode('')).toBeUndefined();
      expect(extractErrorCode('not json')).toBeUndefined();
      expect(extractErrorCode(JSON.stringify({ error: 'x' }))).toBeUndefined();
    });
  });

  it('exposes DomainUpgradeRequiredError as a named Error subclass', () => {
    const error = new DomainUpgradeRequiredError(
      'Custom domains require Baci Starter or higher'
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('DomainUpgradeRequiredError');
    expect(error.message).toContain('Baci Starter');
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
