import { SPACING, TYPOGRAPHY } from '@/constants/Colors';

export const SAVED_ITEM_CARD_STYLE_TOKENS = {
  microSpacing: SPACING.xs / 2,
  discountBadgePaddingHorizontal: SPACING.sm,
  discountBadgePaddingVertical: SPACING.xs / 2,
  discountTextSize: TYPOGRAPHY.size.xs,
  brandTextSize: TYPOGRAPHY.size.xs,
  brandLetterSpacing: 0.5,
  nameTextSize: TYPOGRAPHY.size.base,
  priceTextSize: TYPOGRAPHY.size.lg,
  secondaryTextSize: TYPOGRAPHY.size.sm,
  metaTextSize: TYPOGRAPHY.size.xs,
} as const;
