import { describe, expect, it } from 'vitest';
import { isWalletFundingDeepLink } from './wallet-funding-deep-link';

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
