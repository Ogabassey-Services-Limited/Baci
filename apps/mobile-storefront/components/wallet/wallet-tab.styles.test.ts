import { describe, expect, it } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { walletTabStyles } from './wallet-tab.styles';
import { WALLET_TAB_TYPOGRAPHY } from './wallet-tab.typography';

describe('walletTabStyles', () => {
  it('uses centralized wallet tab typography tokens', () => {
    expect(StyleSheet.flatten(walletTabStyles.headerTitle)).toMatchObject({
      fontFamily: WALLET_TAB_TYPOGRAPHY.fontFamily.bold,
      fontSize: WALLET_TAB_TYPOGRAPHY.size.headerTitle,
    });
    expect(StyleSheet.flatten(walletTabStyles.balanceAmount)).toMatchObject({
      fontFamily: WALLET_TAB_TYPOGRAPHY.fontFamily.bold,
      fontSize: WALLET_TAB_TYPOGRAPHY.size.balanceAmount,
    });
    expect(StyleSheet.flatten(walletTabStyles.pointsAmount)).toMatchObject({
      fontFamily: WALLET_TAB_TYPOGRAPHY.fontFamily.bold,
      fontSize: WALLET_TAB_TYPOGRAPHY.size.pointsAmount,
    });
  });
});
