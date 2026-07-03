import { describe, expect, it } from 'vitest';
import {
  getPushTokenDeactivationReason,
  shouldDeactivateForInvalidCredentials,
} from './push-token-errors';

describe('getPushTokenDeactivationReason', () => {
  it.each([
    'DeviceNotRegistered',
    'InvalidCredentials',
  ])('returns the code for undeliverable error %s', (code) => {
    expect(getPushTokenDeactivationReason(code)).toBe(code);
  });

  it.each([
    'MessageRateExceeded',
    'MessageTooBig',
    'ExpoError',
    'ProviderError',
    'DeveloperError',
  ])('returns null for transient/message-level error %s', (code) => {
    expect(getPushTokenDeactivationReason(code)).toBeNull();
  });

  it.each([
    undefined,
    null,
    42,
    {},
    '',
  ])('returns null for non-string or empty input %o', (value) => {
    expect(getPushTokenDeactivationReason(value)).toBeNull();
  });
});

describe('shouldDeactivateForInvalidCredentials', () => {
  it('prunes an isolated failure inside a large batch (the recurring-noise case)', () => {
    expect(shouldDeactivateForInvalidCredentials(1, 205)).toBe(true);
  });

  it('prunes at exactly the 10% boundary of the minimum batch', () => {
    expect(shouldDeactivateForInvalidCredentials(1, 10)).toBe(true);
  });

  it('stays report-only when failures are widespread (project credential breakage)', () => {
    expect(shouldDeactivateForInvalidCredentials(80, 205)).toBe(false);
    expect(shouldDeactivateForInvalidCredentials(2, 10)).toBe(false);
  });

  it('stays report-only for small batches where the failure modes are indistinguishable', () => {
    expect(shouldDeactivateForInvalidCredentials(1, 9)).toBe(false);
    expect(shouldDeactivateForInvalidCredentials(1, 1)).toBe(false);
  });
});
