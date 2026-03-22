import { describe, expect, it } from 'vitest';
import { formatDisplayCurrency } from '@/lib/format-display-currency';

describe('formatDisplayCurrency', () => {
  it('formats NGN amounts with two decimals', () => {
    const formatted = formatDisplayCurrency(1500, 'NGN');

    expect(formatted).toContain('1,500.00');
    expect(formatted).toMatch(/NGN|₦/);
  });

  it('formats zero, negative, and fractional amounts predictably', () => {
    expect(formatDisplayCurrency(0, 'NGN')).toContain('0.00');
    const negativeFormatted = formatDisplayCurrency(-1500, 'NGN');

    expect(negativeFormatted).toContain('1,500.00');
    expect(negativeFormatted).toMatch(/[-−]/);
    expect(formatDisplayCurrency(1500.5, 'NGN')).toContain('1,500.50');
    expect(formatDisplayCurrency(1500.99, 'NGN')).toContain('1,500.99');
  });

  it('formats large numbers and other supported currencies with locale-aware symbols', () => {
    expect(formatDisplayCurrency(1_000_000, 'NGN')).toContain('1,000,000.00');

    const usd = formatDisplayCurrency(250, 'USD');
    const gbp = formatDisplayCurrency(250, 'GBP');

    expect(usd).toContain('250.00');
    expect(usd).toMatch(/USD|\$/);
    expect(gbp).toContain('250.00');
    expect(gbp).toMatch(/GBP|£/);
  });

  it('throws for unsupported currency codes', () => {
    expect(() => formatDisplayCurrency(250, 'NOT_REAL')).toThrow();
  });
});
