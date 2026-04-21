import { SPACING } from './Colors';

export const STOREFRONT_INSET_DEFAULTS = {
  // These values intentionally extend beyond the shared spacing scale where
  // the current tokens do not cover storefront safe-area and scroll affordances.
  listGap: 12,
  listPadding: SPACING.md,
  scrollPaddingBottom: 60,
  scrollPaddingTop: 20,
} as const;
