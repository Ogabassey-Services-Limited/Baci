import { describe, expect, it } from '@jest/globals';
import { WALLET_TAB_TYPOGRAPHY } from './wallet-tab.typography';

describe('WALLET_TAB_TYPOGRAPHY', () => {
  it('exports expected font families', () => {
    expect(WALLET_TAB_TYPOGRAPHY.fontFamily.bold).toBe('Inter_700Bold');
    expect(WALLET_TAB_TYPOGRAPHY.fontFamily.medium).toBe('Inter_500Medium');
    expect(WALLET_TAB_TYPOGRAPHY.fontFamily.semiBold).toBe('Inter_600SemiBold');
  });

  it.each([
    ['actionLabel', 12],
    ['headerTitle', 28],
    ['balanceAmount', 36],
    ['pointsAmount', 32],
  ] as const)('exports expected %s font size', (key, expected) => {
    expect(WALLET_TAB_TYPOGRAPHY.size[key]).toBe(expected);
  });
});
