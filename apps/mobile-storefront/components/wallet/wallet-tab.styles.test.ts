import { describe, expect, it } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { walletTabStyles } from './wallet-tab.styles';
import { WALLET_TAB_TYPOGRAPHY } from './wallet-tab.typography';

describe('walletTabStyles', () => {
  it.each([
    {
      styleKey: 'headerTitle',
      fontFamily: WALLET_TAB_TYPOGRAPHY.fontFamily.bold,
      fontSize: WALLET_TAB_TYPOGRAPHY.size.headerTitle,
    },
    {
      styleKey: 'balanceLabel',
      fontFamily: WALLET_TAB_TYPOGRAPHY.fontFamily.medium,
      fontSize: WALLET_TAB_TYPOGRAPHY.size.body,
    },
    {
      styleKey: 'balanceAmount',
      fontFamily: WALLET_TAB_TYPOGRAPHY.fontFamily.bold,
      fontSize: WALLET_TAB_TYPOGRAPHY.size.balanceAmount,
    },
    {
      styleKey: 'balanceActionText',
      fontFamily: WALLET_TAB_TYPOGRAPHY.fontFamily.medium,
      fontSize: WALLET_TAB_TYPOGRAPHY.size.body,
    },
    {
      styleKey: 'pointsLabel',
      fontFamily: WALLET_TAB_TYPOGRAPHY.fontFamily.semiBold,
      fontSize: WALLET_TAB_TYPOGRAPHY.size.body,
    },
    {
      styleKey: 'pointsAmount',
      fontFamily: WALLET_TAB_TYPOGRAPHY.fontFamily.bold,
      fontSize: WALLET_TAB_TYPOGRAPHY.size.pointsAmount,
    },
    {
      styleKey: 'redeemButtonText',
      fontFamily: WALLET_TAB_TYPOGRAPHY.fontFamily.bold,
      fontSize: WALLET_TAB_TYPOGRAPHY.size.body,
    },
    {
      styleKey: 'sectionTitle',
      fontFamily: WALLET_TAB_TYPOGRAPHY.fontFamily.bold,
      fontSize: WALLET_TAB_TYPOGRAPHY.size.sectionTitle,
    },
    {
      styleKey: 'quickActionLabel',
      fontFamily: WALLET_TAB_TYPOGRAPHY.fontFamily.semiBold,
      fontSize: WALLET_TAB_TYPOGRAPHY.size.actionLabel,
    },
  ] as const)('uses centralized wallet tab typography tokens for $styleKey', ({
    styleKey,
    fontFamily,
    fontSize,
  }) => {
    expect(StyleSheet.flatten(walletTabStyles[styleKey])).toMatchObject({
      fontFamily,
      fontSize,
    });
  });
});
