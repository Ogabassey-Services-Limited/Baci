import type { ImeiIdentifierType } from './service-tier-types';

const IMEI_PATTERN = /^\d{15}$/;
// Apple serials are 8–14 alphanumeric (older 11–12 chars, 2021+ randomized 10).
const APPLE_SERIAL_PATTERN = /^[A-Z0-9]{8,14}$/i;

/** 15-digit IMEI with a valid Luhn checksum. */
export function isValidImeiChecksum(value: string): boolean {
  if (!IMEI_PATTERN.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i += 1) {
    let digit = Number.parseInt(value[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Apple serial number shape (8–14 alphanumeric). */
export function isValidAppleSerial(value: string): boolean {
  return APPLE_SERIAL_PATTERN.test(value);
}

/**
 * Validate a device identifier against the identifier type a service accepts.
 * `both` accepts either an IMEI (15 digits + Luhn) or an Apple serial.
 */
export function isValidDeviceIdentifier(
  value: string,
  identifier: ImeiIdentifierType
): boolean {
  switch (identifier) {
    case 'imei':
      return isValidImeiChecksum(value);
    case 'serial':
      return isValidAppleSerial(value);
    case 'both':
      return isValidImeiChecksum(value) || isValidAppleSerial(value);
    default:
      return false;
  }
}

/**
 * Resolve the identifier the input should actually use, given the tier's
 * accepted identifier and the selected device's physical identifier.
 *
 * A tier that accepts either (`both`) defers to what the device physically has
 * — so a `both` tier shown on a laptop/watch tab becomes serial-only and won't
 * accept a phone IMEI. A tier that requires a specific identifier keeps its own
 * requirement (e.g. a `serial` GSX tier stays serial even on the phone tab).
 */
export function resolveInputIdentifier(
  tierIdentifier: ImeiIdentifierType,
  deviceIdentifier: ImeiIdentifierType
): ImeiIdentifierType {
  return tierIdentifier === 'both' ? deviceIdentifier : tierIdentifier;
}

/**
 * Normalize raw input for a given identifier type as the user types:
 * IMEI → digits only (max 15); serial → uppercase alphanumeric (max 14).
 */
export function normalizeDeviceIdentifier(
  raw: string,
  identifier: ImeiIdentifierType
): string {
  if (identifier === 'imei') {
    return raw.replace(/\D/g, '').slice(0, 15);
  }
  // Serial cap is 15 (one past the 14-char max) NOT 14: capping at 14 would
  // silently shorten a pasted 15-digit IMEI into a 14-char string that passes
  // the 8–14 serial check, letting a wrong-identifier lookup be billed. Keeping
  // the extra char leaves an over-length serial invalid so it's rejected.
  if (identifier === 'serial') {
    return raw
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 15);
  }
  // both: keep alphanumeric, uppercased; allow up to 15 (IMEI length).
  return raw
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 15);
}
