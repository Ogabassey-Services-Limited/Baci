/**
 * Typography configuration for wallet tab components.
 */
export const WALLET_TAB_TYPOGRAPHY = {
  fontFamily: {
    bold: 'Inter_700Bold',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
  },
  size: {
    actionLabel: 12,
    body: 14,
    balanceAmount: 36,
    headerTitle: 28,
    pointsAmount: 32,
    sectionTitle: 18,
  },
} as const;

export type WalletTabTypography = typeof WALLET_TAB_TYPOGRAPHY;
