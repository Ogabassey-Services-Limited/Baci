import { describe, expect, it } from 'vitest';
import { getPushTokenDeactivationReason } from './push-token-errors';

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
