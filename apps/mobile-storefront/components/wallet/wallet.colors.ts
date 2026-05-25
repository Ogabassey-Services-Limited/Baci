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
  mutedText: withAlpha(palette.white, 0.72),
  quickSaveBackground: palette.gray[800],
  secondaryBorder: palette.gray[300],
  white: palette.white,
};
