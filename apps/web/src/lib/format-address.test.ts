import { describe, expect, it } from 'vitest';
import { formatAddress } from './format-address';

describe('formatAddress', () => {
  it('returns fallback text when address is null', () => {
    expect(formatAddress(null)).toBe('No address provided');
  });

  it('returns the string as-is when address is a string', () => {
    expect(formatAddress('123 Main St, Lagos')).toBe('123 Main St, Lagos');
  });

  it('formats an object address with all fields', () => {
    const addr = {
      address_line1: '10 Broad Street',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
    };
    expect(formatAddress(addr)).toBe('10 Broad Street, Lagos, Lagos, Nigeria');
  });

  it('formats an object address with partial fields', () => {
    const addr = { city: 'Abuja', country: 'Nigeria' };
    expect(formatAddress(addr)).toBe('Abuja, Nigeria');
  });

  it('returns fallback when object has no recognized fields', () => {
    const addr = { zip: '100001' };
    expect(formatAddress(addr)).toBe('Address details unavailable');
  });

  it('returns fallback text for empty string', () => {
    expect(formatAddress('')).toBe('No address provided');
  });
});
