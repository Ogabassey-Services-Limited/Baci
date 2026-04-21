import { describe, expect, it } from '@jest/globals';
import { formatNgnCurrency } from './format-ngn-currency';

describe('formatNgnCurrency', () => {
  it('formats naira amounts without fractional digits', () => {
    expect(formatNgnCurrency(2500)).toContain('2,500');
    expect(formatNgnCurrency(2500.75)).not.toContain('.');
  });
});
