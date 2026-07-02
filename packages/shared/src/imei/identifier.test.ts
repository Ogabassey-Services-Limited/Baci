import { describe, expect, it } from 'vitest';
import {
  isValidAppleSerial,
  isValidDeviceIdentifier,
  isValidImeiChecksum,
  normalizeDeviceIdentifier,
  resolveInputIdentifier,
} from './identifier';

describe('isValidImeiChecksum', () => {
  it('accepts a 15-digit IMEI with a valid Luhn checksum', () => {
    expect(isValidImeiChecksum('490154203237518')).toBe(true);
  });

  it('rejects a bad checksum, wrong length, or non-digits', () => {
    expect(isValidImeiChecksum('490154203237519')).toBe(false);
    expect(isValidImeiChecksum('49015420323751')).toBe(false);
    expect(isValidImeiChecksum('49015420323751A')).toBe(false);
  });
});

describe('isValidAppleSerial', () => {
  it('accepts 8–14 alphanumeric serials', () => {
    expect(isValidAppleSerial('C02XL0ABJGH5')).toBe(true);
    expect(isValidAppleSerial('DNPX1234567')).toBe(true);
  });

  it('rejects too short, too long, or symbol-bearing serials', () => {
    expect(isValidAppleSerial('ABC123')).toBe(false);
    expect(isValidAppleSerial('C02XL0ABJGH5EXTRA')).toBe(false);
    expect(isValidAppleSerial('C02-XL0ABJ')).toBe(false);
  });
});

describe('isValidDeviceIdentifier', () => {
  it('applies IMEI rules for imei-only tiers', () => {
    expect(isValidDeviceIdentifier('490154203237518', 'imei')).toBe(true);
    expect(isValidDeviceIdentifier('C02XL0ABJGH5', 'imei')).toBe(false);
  });

  it('applies serial rules for serial-only tiers', () => {
    expect(isValidDeviceIdentifier('C02XL0ABJGH5', 'serial')).toBe(true);
    expect(isValidDeviceIdentifier('490154203237518', 'serial')).toBe(false);
  });

  it('accepts either identifier for both-mode tiers', () => {
    expect(isValidDeviceIdentifier('490154203237518', 'both')).toBe(true);
    expect(isValidDeviceIdentifier('C02XL0ABJGH5', 'both')).toBe(true);
    expect(isValidDeviceIdentifier('!!bad!!', 'both')).toBe(false);
  });
});

describe('normalizeDeviceIdentifier', () => {
  it('keeps only digits (max 15) for IMEI mode', () => {
    expect(normalizeDeviceIdentifier('49-01 54abc', 'imei')).toBe('490154');
    expect(
      normalizeDeviceIdentifier('1234567890123456789', 'imei')
    ).toHaveLength(15);
  });

  it('uppercases and strips separators for serial mode', () => {
    expect(normalizeDeviceIdentifier('c02xl0-abjgh5', 'serial')).toBe(
      'C02XL0ABJGH5'
    );
  });

  it('does not shorten an over-length serial into a valid 14-char value', () => {
    // A pasted 15-digit IMEI on a serial tier must stay 15 chars (invalid),
    // not be sliced to a spurious 14-char "valid" serial that bills a lookup.
    const normalized = normalizeDeviceIdentifier('354442067957452', 'serial');
    expect(normalized).toBe('354442067957452');
    expect(isValidDeviceIdentifier(normalized, 'serial')).toBe(false);
  });

  it('keeps uppercased alphanumerics (max 15) for both mode', () => {
    expect(normalizeDeviceIdentifier('49-01 54abc', 'both')).toBe('490154ABC');
    expect(
      normalizeDeviceIdentifier('1234567890123456789', 'both')
    ).toHaveLength(15);
  });
});

describe('resolveInputIdentifier', () => {
  it('narrows a both-tier to the device identifier on serial-only tabs', () => {
    // A "both" tier on a laptop/watch tab must reject a phone IMEI.
    expect(resolveInputIdentifier('both', 'serial')).toBe('serial');
    expect(resolveInputIdentifier('both', 'imei')).toBe('imei');
    expect(resolveInputIdentifier('both', 'both')).toBe('both');
  });

  it('keeps a specific tier identifier regardless of the device', () => {
    // A serial-only GSX tier stays serial even on the phone (imei) tab.
    expect(resolveInputIdentifier('serial', 'imei')).toBe('serial');
    expect(resolveInputIdentifier('imei', 'serial')).toBe('imei');
  });
});
