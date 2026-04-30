import { sanitizeAmountInput } from '@/components/utilities/utility-amount-sanitize';

describe('sanitizeAmountInput', () => {
  it('keeps only one decimal point and limits fractional digits', () => {
    expect(sanitizeAmountInput('₦1,2.3a456')).toBe('12.34');
    expect(sanitizeAmountInput('1.2.3')).toBe('1.23');
  });

  it('preserves a trailing decimal while the user is typing', () => {
    expect(sanitizeAmountInput('.')).toBe('');
    expect(sanitizeAmountInput('12.')).toBe('12.');
  });

  it('handles common boundary inputs', () => {
    expect(sanitizeAmountInput('')).toBe('');
    expect(sanitizeAmountInput('12345')).toBe('12345');
    expect(sanitizeAmountInput('0')).toBe('0');
    expect(sanitizeAmountInput('0.00')).toBe('0.00');
    expect(sanitizeAmountInput('   123.45   ')).toBe('123.45');
    expect(sanitizeAmountInput('9'.repeat(100))).toBe('9'.repeat(100));
  });
});
