import { describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizationErrorBody,
  getAuthorizationErrorStatus,
  getCheckoutCompletionAuthorizationSecrets,
  getCheckoutGrandTotal,
} from '@/lib/agentic/checkout-completion-authorization-response';

describe('checkout completion authorization response helpers', () => {
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
  });

  it('maps authorization error bodies and statuses', () => {
    expect(buildAuthorizationErrorBody('CONFIRMATION_REQUIRED')).toEqual({
      code: 'CONFIRMATION_REQUIRED',
      error: 'Human confirmation required',
      retryable: true,
    });
    expect(getAuthorizationErrorStatus('CONFIRMATION_REQUIRED')).toBe(428);
    expect(getAuthorizationErrorStatus('SERVER_CONFIGURATION_ERROR')).toBe(503);
    expect(getAuthorizationErrorStatus('AUTHORIZATION_INVALID')).toBe(403);
  });

  it('returns only configured checkout authorization secrets', () => {
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', 'current-secret');
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS', '');

    expect(getCheckoutCompletionAuthorizationSecrets()).toEqual([
      'current-secret',
    ]);

    vi.unstubAllEnvs();
  });
});
