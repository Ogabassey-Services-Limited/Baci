import { palette, withAlpha } from '@/constants/Colors';

export const WALLET_COLORS = {
  balanceDivider: withAlpha(palette.white, 0.2),
  balanceTabBackground: withAlpha(palette.white, 0.08),
  darkText: palette.gray[950],
  fundingCopyBackground: palette.gray[100],
  fundingText: palette.gray[900],
  heroBackground: palette.gray[950],
  heroBorder: withAlpha(palette.white, 0.16),
  heroOutline: palette.gray[800],
  loyaltyTierBronzeBackground: '#7C2D12',
  loyaltyTierGoldBackground: palette.amber[800],
  loyaltyTierPlatinumBackground: '#4338CA',
  loyaltyTierSilverBackground: palette.gray[700],
  loyaltyTierText: palette.white,
  mutedText: withAlpha(palette.white, 0.72),
  progressTrack: palette.gray[100],
  quickSaveBackground: palette.gray[800],
  secondaryBorder: palette.gray[300],
  savingsAccent: palette.emerald[600],
  white: palette.white,
};
