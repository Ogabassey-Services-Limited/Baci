import { describe, expect, it } from 'vitest';
import { detectPayPalResponseMode } from './paypal-mode-guard';

describe('detectPayPalResponseMode', () => {
  it('detects live mode from the self link host', () => {
    const mode = detectPayPalResponseMode([
      { href: 'https://api-m.paypal.com/v2/checkout/orders/1', rel: 'self' },
    ]);
    expect(mode).toBe('live');
  });

  it('detects sandbox mode from the self link host', () => {
    const mode = detectPayPalResponseMode([
      {
        href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/1',
        rel: 'self',
      },
    ]);
    expect(mode).toBe('sandbox');
  });

  it('falls back to the first link when no rel="self" link is present', () => {
    const mode = detectPayPalResponseMode([
      {
        href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/1/capture',
        rel: 'capture',
      },
    ]);
    expect(mode).toBe('sandbox');
  });

  it('returns "unknown" when links is empty', () => {
    expect(detectPayPalResponseMode([])).toBe('unknown');
  });

  it('returns "unknown" when links is null or undefined', () => {
    expect(detectPayPalResponseMode(null)).toBe('unknown');
    expect(detectPayPalResponseMode(undefined)).toBe('unknown');
  });

  it('returns "unknown" for an unrecognized host', () => {
    const mode = detectPayPalResponseMode([
      { href: 'https://evil.example.com/v2/checkout/orders/1', rel: 'self' },
    ]);
    expect(mode).toBe('unknown');
  });

  it('returns "unknown" for a malformed href instead of throwing', () => {
    const mode = detectPayPalResponseMode([{ href: 'not-a-url', rel: 'self' }]);
    expect(mode).toBe('unknown');
  });
});
