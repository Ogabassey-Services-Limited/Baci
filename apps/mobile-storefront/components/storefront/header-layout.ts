import { SPACING } from '@/constants/Colors';

/**
 * Calculates elite storefront header top padding from topInset while enforcing
 * SPACING.xs as the minimum visual offset.
 */
export function getEliteHeaderTopPadding(topInset: number): number {
  if (!Number.isFinite(topInset)) {
    return SPACING.xs;
  }

  return Math.max(topInset, SPACING.xs);
}
