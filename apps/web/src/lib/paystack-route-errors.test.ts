import { describe, expect, it } from 'vitest';
import {
  getPaystackFailureMessage,
  getPaystackFailureStatus,
} from '@/lib/paystack-route-errors';

describe('getPaystackFailureStatus', () => {
  it('maps validation errors to 400', () => {
    expect(getPaystackFailureStatus('VALIDATION_ERROR')).toBe(400);
    expect(getPaystackFailureStatus('HTTP_400')).toBe(400);
  });

  it('maps configuration errors to 500', () => {
    expect(getPaystackFailureStatus('CONFIG_ERROR')).toBe(500);
  });

  it('maps upstream and network failures to 502', () => {
    expect(getPaystackFailureStatus('NETWORK_ERROR')).toBe(502);
    expect(getPaystackFailureStatus('HTTP_502')).toBe(502);
    expect(getPaystackFailureStatus(undefined)).toBe(502);
  });
});

describe('getPaystackFailureMessage', () => {
  it('hides configuration details from clients', () => {
    expect(
      getPaystackFailureMessage(
        {
          error: 'PAYSTACK_SECRET_KEY is not configured',
          code: 'CONFIG_ERROR',
        },
        'Fallback message'
      )
    ).toBe('Service configuration error');
  });

  it('returns the provider message for non-configuration failures', () => {
    expect(
      getPaystackFailureMessage(
        { error: 'Gateway timeout', code: 'HTTP_502' },
        'Fallback message'
      )
    ).toBe('Gateway timeout');
  });

  it('falls back when the provider does not return a message', () => {
    expect(getPaystackFailureMessage({}, 'Fallback message')).toBe(
      'Fallback message'
    );
  });
});
