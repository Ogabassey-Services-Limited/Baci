import { normalizeCheckoutPhone } from './normalize-checkout-phone';

describe('normalizeCheckoutPhone', () => {
  it('normalizes spaced Nigerian E.164 numbers', () => {
    expect(normalizeCheckoutPhone('+234 801 234 5678')).toBe('+2348012345678');
  });

  it('converts Nigerian local numbers into E.164', () => {
    expect(normalizeCheckoutPhone('08012345678')).toBe('+2348012345678');
  });

  it('converts 10-digit Nigerian numbers missing leading zero into E.164', () => {
    expect(normalizeCheckoutPhone('8012345678')).toBe('+2348012345678');
  });

  it('preserves other international numbers with a plus prefix', () => {
    expect(normalizeCheckoutPhone('+1 (555) 123-4567')).toBe('+15551234567');
  });

  it('returns an empty string for missing values', () => {
    expect(normalizeCheckoutPhone(undefined)).toBe('');
  });

  it('does not coerce incomplete 234-prefixed numbers into E.164', () => {
    expect(normalizeCheckoutPhone('2341234')).toBe('2341234');
  });
});
