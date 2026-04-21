import { describe, expect, it } from '@jest/globals';
import { formatNgnCurrency } from './format-ngn-currency';

describe('formatNgnCurrency', () => {
  it('formats whole-naira amounts cleanly and preserves Kobo precision', () => {
    expect(formatNgnCurrency(2500)).toBe('₦2,500');
    expect(formatNgnCurrency(2500.75)).toBe('₦2,500.75');
  });
});
