import { normalizeCheckoutPhone } from './normalize-checkout-phone';

describe('normalizeCheckoutPhone', () => {
  it('normalizes spaced Nigerian E.164 numbers', () => {
    expect(normalizeCheckoutPhone('+234 801 234 5678')).toBe(
      '+2348012345678'
    );
  });

  it('converts Nigerian local numbers into E.164', () => {
    expect(normalizeCheckoutPhone('08012345678')).toBe('+2348012345678');
  });

  it('preserves other international numbers with a plus prefix', () => {
    expect(normalizeCheckoutPhone('+1 (555) 123-4567')).toBe('+15551234567');
  });

  it('returns an empty string for missing values', () => {
    expect(normalizeCheckoutPhone(undefined)).toBe('');
  });
});
