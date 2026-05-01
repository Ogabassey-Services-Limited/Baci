import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizationErrorBody,
  getAuthorizationErrorStatus,
  getCheckoutCompletionAuthorizationSecrets,
  getCheckoutGrandTotal,
} from '@/lib/agentic/checkout-completion-authorization-response';

describe('checkout completion authorization response helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads numeric and string checkout totals', () => {
    expect(
      getCheckoutGrandTotal([
        { type: 'subtotal', display_text: 'Subtotal', amount: 1000 },
        { type: 'total', display_text: 'Total', amount: '2500.50' },
      ])
    ).toBe(2500.5);
  });

  it('throws for missing or invalid checkout totals', () => {
    expect(() => getCheckoutGrandTotal([])).toThrow(
      'Missing or invalid total amount'
    );
    expect(() =>
      getCheckoutGrandTotal([
        { type: 'total', display_text: 'Total', amount: Number.NaN },
      ])
    ).toThrow('Missing or invalid total amount');
    for (const amount of [
      '',
      ' ',
      '  100  ',
      '1000NGN',
      '1,000',
      '-5',
      '1.2.3',
      '1e10',
      '1.5e-3',
      'Infinity',
      '-Infinity',
      'NaN',
    ]) {
      expect(() =>
        getCheckoutGrandTotal([
          { type: 'total', display_text: 'Total', amount },
        ])
      ).toThrow('Missing or invalid total amount');
    }
    expect(() =>
      getCheckoutGrandTotal([
        { type: 'total', display_text: 'Total', amount: -5 },
      ])
    ).toThrow('Missing or invalid total amount');
  });

  it('maps authorization error bodies and statuses', () => {
    expect(buildAuthorizationErrorBody('CONFIRMATION_REQUIRED')).toEqual({
      code: 'CONFIRMATION_REQUIRED',
      error: 'Human confirmation required',
      retryable: true,
    });
    expect(buildAuthorizationErrorBody('SERVER_CONFIGURATION_ERROR')).toEqual({
      code: 'SERVER_CONFIGURATION_ERROR',
      error: 'Checkout authorization is temporarily unavailable',
      retryable: false,
    });
    expect(buildAuthorizationErrorBody('AUTHORIZATION_INVALID')).toEqual({
      code: 'AUTHORIZATION_INVALID',
      error: 'Checkout authorization invalid',
      retryable: false,
    });
    expect(getAuthorizationErrorStatus('CONFIRMATION_REQUIRED')).toBe(428);
    expect(getAuthorizationErrorStatus('SERVER_CONFIGURATION_ERROR')).toBe(503);
    expect(getAuthorizationErrorStatus('AUTHORIZATION_INVALID')).toBe(403);
  });

  it('returns only configured checkout authorization secrets', () => {
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', ' current-secret ');
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS', ' ');

    expect(getCheckoutCompletionAuthorizationSecrets()).toEqual([
      'current-secret',
    ]);
  });
});
