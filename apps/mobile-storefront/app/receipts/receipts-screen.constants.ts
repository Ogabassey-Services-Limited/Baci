import { SPACING, TYPOGRAPHY } from '@/constants/Colors';

export const RECEIPTS_SCREEN_STYLE_TOKENS = {
  errorTextSize: TYPOGRAPHY.size.base,
  errorTextMarginTop: SPACING.sm + SPACING.xs,
  retryTextSize: TYPOGRAPHY.size.sm,
  retryTextMarginTop: SPACING.sm,
  generatingBannerGap: SPACING.sm,
  generatingBannerPaddingVertical: SPACING.sm + SPACING.xs / 2,
  generatingTextSize: TYPOGRAPHY.size.sm,
} as const;
