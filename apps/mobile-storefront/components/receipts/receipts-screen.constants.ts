import { SPACING, TYPOGRAPHY } from '@/constants/Colors';

const xsHalf = SPACING.xs / 2;

export const RECEIPTS_SCREEN_STYLE_TOKENS = {
  errorTextSize: TYPOGRAPHY.size.base,
  errorTextMarginTop: SPACING.sm + SPACING.xs,
  retryTextSize: TYPOGRAPHY.size.sm,
  retryTextMarginTop: SPACING.sm,
  generatingBannerGap: SPACING.sm,
  generatingBannerPaddingVertical: SPACING.sm + xsHalf,
  generatingTextSize: TYPOGRAPHY.size.sm,
} as const;
