import { describe, expect, it } from 'vitest';
import {
  getPayPalBaseUrl,
  PAYPAL_LIVE_API_URL,
  PAYPAL_SANDBOX_API_URL,
} from './paypal-endpoints';

describe('getPayPalBaseUrl', () => {
  it('returns the sandbox URL for mode "sandbox"', () => {
    expect(getPayPalBaseUrl('sandbox')).toBe(PAYPAL_SANDBOX_API_URL);
  });

  it('returns the live URL for mode "live"', () => {
    expect(getPayPalBaseUrl('live')).toBe(PAYPAL_LIVE_API_URL);
  });
});
