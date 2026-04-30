import { formatUtilityAmountInput } from '@/components/utilities/utility-amount-format';

describe('formatUtilityAmountInput', () => {
  it('formats amount input with thousands separators', () => {
    expect(formatUtilityAmountInput('1000')).toBe('1,000');
    expect(formatUtilityAmountInput(250000)).toBe('250,000');
    expect(formatUtilityAmountInput(1_000_000_000)).toBe('1,000,000,000');
  });

  it('formats decimal, negative, and already formatted amount input consistently', () => {
    expect(formatUtilityAmountInput('1000.50')).toBe('1,000.5');
    expect(formatUtilityAmountInput('1234.56')).toBe('1,234.56');
    expect(formatUtilityAmountInput(1000.5)).toBe('1,000.5');
    expect(formatUtilityAmountInput(-1000)).toBe('-1,000');
    expect(formatUtilityAmountInput('1,000')).toBe('1,000');
  });

  it('formats mixed whitespace and comma input consistently', () => {
    expect(formatUtilityAmountInput(' 1,234.50 ')).toBe('1,234.5');
    expect(formatUtilityAmountInput('\t2,500\n')).toBe('2,500');
  });

  it('formats zero explicitly and returns empty string for unset input', () => {
    expect(formatUtilityAmountInput('')).toBe('');
    expect(formatUtilityAmountInput(0)).toBe('0');
    expect(formatUtilityAmountInput('abc')).toBe('');
    expect(formatUtilityAmountInput(null as unknown as string)).toBe('');
    expect(formatUtilityAmountInput(undefined as unknown as string)).toBe('');
  });

  it('returns empty string for NaN and infinite input', () => {
    expect(formatUtilityAmountInput(Number.NaN)).toBe('');
    expect(formatUtilityAmountInput(Number.POSITIVE_INFINITY)).toBe('');
    expect(formatUtilityAmountInput(Number.NEGATIVE_INFINITY)).toBe('');
    expect(formatUtilityAmountInput('NaN')).toBe('');
    expect(formatUtilityAmountInput('Infinity')).toBe('');
    expect(formatUtilityAmountInput('+Infinity')).toBe('');
    expect(formatUtilityAmountInput('-Infinity')).toBe('');
  });

  it('normalizes scientific notation input', () => {
    expect(formatUtilityAmountInput('1e6')).toBe('1,000,000');
    expect(formatUtilityAmountInput('2.5e3')).toBe('2,500');
    expect(formatUtilityAmountInput('-1e3')).toBe('-1,000');
    expect(formatUtilityAmountInput('-2.5e3')).toBe('-2,500');
    expect(formatUtilityAmountInput('1e-3')).toBe('0');
    expect(formatUtilityAmountInput('-2.5e-3')).toBe('-0');
  });

  it('normalizes decimal edge cases', () => {
    expect(formatUtilityAmountInput('.5')).toBe('0.5');
    expect(formatUtilityAmountInput('5.')).toBe('5');
    expect(formatUtilityAmountInput('1.2.3')).toBe('');
  });

  it('trims leading zeros', () => {
    expect(formatUtilityAmountInput('007')).toBe('7');
    expect(formatUtilityAmountInput('0123')).toBe('123');
  });

  it('accepts an explicit locale for display formatting', () => {
    expect(formatUtilityAmountInput('1234.5', 'de-DE')).toBe('1.234,5');
    expect(formatUtilityAmountInput('1.234,56', 'de-DE')).toBe('1.234,56');
    expect(formatUtilityAmountInput('1,5', 'de-DE')).toBe('1,5');
  });

  it('returns empty string for English-formatted input when locale is de-DE', () => {
    expect(formatUtilityAmountInput('1,234.5', 'de-DE')).toBe('');
  });

  it('formats input when the runtime does not support formatToParts', () => {
    const originalFormatToParts = Intl.NumberFormat.prototype.formatToParts;
    Object.defineProperty(Intl.NumberFormat.prototype, 'formatToParts', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(formatUtilityAmountInput('1000')).toBe('1,000');
      expect(formatUtilityAmountInput('1,000')).toBe('1,000');
      expect(formatUtilityAmountInput('1234.5', 'de-DE')).toBe('1.234,5');
      expect(formatUtilityAmountInput('1.234,56', 'de-DE')).toBe('1.234,56');
      expect(formatUtilityAmountInput('1234.5', 'ja-JP')).toBe('1,234.5');
      expect(formatUtilityAmountInput('1234.5', 'zh-CN')).toBe('1,234.5');
    } finally {
      Object.defineProperty(Intl.NumberFormat.prototype, 'formatToParts', {
        configurable: true,
        value: originalFormatToParts,
      });
    }
  });
});
