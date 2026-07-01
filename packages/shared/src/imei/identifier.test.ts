import { describe, expect, it } from 'vitest';
import {
  isValidAppleSerial,
  isValidDeviceIdentifier,
  isValidImeiChecksum,
  normalizeDeviceIdentifier,
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

  it('uppercases alphanumerics (max 14) for serial mode', () => {
    expect(normalizeDeviceIdentifier('c02xl0-abjgh5', 'serial')).toBe(
      'C02XL0ABJGH5'
    );
  });
});
