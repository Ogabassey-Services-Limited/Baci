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

  it('formats zero explicitly and returns empty string for unset input', () => {
    expect(formatUtilityAmountInput('')).toBe('');
    expect(formatUtilityAmountInput(0)).toBe('0');
    expect(formatUtilityAmountInput('abc')).toBe('');
    expect(formatUtilityAmountInput(null as unknown as string)).toBe('');
    expect(formatUtilityAmountInput(undefined as unknown as string)).toBe('');
  });
});
