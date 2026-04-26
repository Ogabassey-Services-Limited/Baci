import { describe, expect, it } from '@jest/globals';
import { WALLET_TAB_TYPOGRAPHY } from './wallet-tab.typography';

describe('WALLET_TAB_TYPOGRAPHY', () => {
  it('exports expected font families', () => {
    expect(WALLET_TAB_TYPOGRAPHY.fontFamily).toHaveProperty('bold');
    expect(WALLET_TAB_TYPOGRAPHY.fontFamily).toHaveProperty('medium');
    expect(WALLET_TAB_TYPOGRAPHY.fontFamily).toHaveProperty('semiBold');
  });

  it('exports expected wallet tab font sizes', () => {
    expect(WALLET_TAB_TYPOGRAPHY.size).toHaveProperty('headerTitle');
    expect(WALLET_TAB_TYPOGRAPHY.size).toHaveProperty('balanceAmount');
    expect(WALLET_TAB_TYPOGRAPHY.size).toHaveProperty('pointsAmount');
  });
});
