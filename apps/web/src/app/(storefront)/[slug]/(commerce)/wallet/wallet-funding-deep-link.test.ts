import { describe, expect, it } from 'vitest';
import {
  isWalletFundingDeepLink,
  parseUsdtWalletFundingAmount,
  parseUsdtWalletFundingReference,
} from './wallet-funding-deep-link';

describe('isWalletFundingDeepLink', () => {
  it.each([
    ['1', true],
    [['return', '1'], true],
    ['true', false],
    [undefined, false],
  ] as const)('maps %j to %s', (value, expected) => {
    expect(isWalletFundingDeepLink(value)).toBe(expected);
  });
});

describe('parseUsdtWalletFundingReference', () => {
  it.each([
    ['wusdt_m123_1a2b3c', 'wusdt_m123_1a2b3c'],
    [['wusdt_ref_123456', 'ignored'], 'wusdt_ref_123456'],
    ['not a reference', undefined],
    [undefined, undefined],
  ] as const)('maps %j to %s', (value, expected) => {
    expect(parseUsdtWalletFundingReference(value)).toBe(expected);
  });
});

describe('parseUsdtWalletFundingAmount', () => {
  it.each([
    ['65', 65],
    [['12.5', '99'], 12.5],
    ['0', undefined],
    ['invalid', undefined],
  ] as const)('maps %j to %s', (value, expected) => {
    expect(parseUsdtWalletFundingAmount(value)).toBe(expected);
  });
});
