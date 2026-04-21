import { SPACING } from '@/constants/Colors';

export function getEliteHeaderTopPadding(topInset: number) {
  return Math.max(topInset, SPACING.xs);
}
