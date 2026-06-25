import { describe, expect, it } from 'vitest';
import {
  buildTelLink,
  buildWhatsAppLink,
  isValidPhone,
  normalizePhoneToE164,
} from './negotiation-contact';

describe('normalizePhoneToE164', () => {
  it('drops the trunk 0 and prefixes the dial code for national input', () => {
    expect(normalizePhoneToE164('0803 123 4567')).toBe('2348031234567');
  });

  it('strips a leading + and spaces from international input', () => {
    expect(normalizePhoneToE164('+234 803 123 4567')).toBe('2348031234567');
  });

  it('keeps a number already prefixed with the dial code', () => {
    expect(normalizePhoneToE164('2348031234567')).toBe('2348031234567');
  });

  it('prefixes the dial code for a bare national number without trunk 0', () => {
    expect(normalizePhoneToE164('8031234567')).toBe('2348031234567');
  });

  it('handles the 00 international prefix form', () => {
    expect(normalizePhoneToE164('002348031234567')).toBe('2348031234567');
  });

  it('respects a non-default dial code', () => {
    expect(normalizePhoneToE164('020 1234 5678', '44')).toBe('442012345678');
  });

  it('returns null for empty or non-string input', () => {
    expect(normalizePhoneToE164('')).toBeNull();
    expect(normalizePhoneToE164('   ')).toBeNull();
    expect(normalizePhoneToE164(null)).toBeNull();
    expect(normalizePhoneToE164(undefined)).toBeNull();
  });

  it('returns null for junk that is too short or too long', () => {
    expect(normalizePhoneToE164('12')).toBeNull();
    expect(normalizePhoneToE164('+1234567890123456789')).toBeNull();
  });
});

describe('isValidPhone', () => {
  it('is true for a normalizable number and false otherwise', () => {
    expect(isValidPhone('0803 123 4567')).toBe(true);
    expect(isValidPhone('abc')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });
});

describe('buildTelLink', () => {
  it('builds a tel: link with a + prefix', () => {
    expect(buildTelLink('0803 123 4567')).toBe('tel:+2348031234567');
  });

  it('returns null for an unreachable number', () => {
    expect(buildTelLink('nope')).toBeNull();
  });
});

describe('buildWhatsAppLink', () => {
  it('builds a wa.me link with digits only and no message', () => {
    expect(buildWhatsAppLink('0803 123 4567')).toBe(
      'https://wa.me/2348031234567'
    );
  });

  it('URL-encodes a prefilled message', () => {
    expect(
      buildWhatsAppLink('0803 123 4567', 'Hi! About your ₦420,000 offer')
    ).toBe(
      'https://wa.me/2348031234567?text=Hi!%20About%20your%20%E2%82%A6420%2C000%20offer'
    );
  });

  it('ignores a blank message', () => {
    expect(buildWhatsAppLink('0803 123 4567', '   ')).toBe(
      'https://wa.me/2348031234567'
    );
  });

  it('returns null for an unreachable number', () => {
    expect(buildWhatsAppLink('nope', 'hello')).toBeNull();
  });
});
