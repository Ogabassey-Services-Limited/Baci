import { formatUtilityAmountInput } from './utility-amount-format';

describe('formatUtilityAmountInput', () => {
  it('formats amount input with thousands separators', () => {
    expect(formatUtilityAmountInput('1000')).toBe('1,000');
    expect(formatUtilityAmountInput(250000)).toBe('250,000');
  });

  it('returns an empty string when no amount is set', () => {
    expect(formatUtilityAmountInput('')).toBe('');
    expect(formatUtilityAmountInput(0)).toBe('');
  });
});
