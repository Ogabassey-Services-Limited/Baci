import { SPACING } from './Colors';
import { CONTENT_OVERLAY_GAP, TAB_BAR_BASE_HEIGHT } from './layout';

const FLOATING_NAV_CLEARANCE = TAB_BAR_BASE_HEIGHT + CONTENT_OVERLAY_GAP;

export const STOREFRONT_INSET_DEFAULTS = {
  // These values intentionally extend beyond the shared spacing scale where
  // the current tokens do not cover storefront safe-area and scroll affordances.
  listGap: 12,
  listPadding: SPACING.md,
  listPaddingBottom: FLOATING_NAV_CLEARANCE,
  scrollPaddingBottom: FLOATING_NAV_CLEARANCE,
  scrollPaddingTop: 20,
} as const;
