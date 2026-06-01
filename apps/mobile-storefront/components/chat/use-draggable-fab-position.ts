import { EDGE_MARGIN, FAB_SIZE } from './constants';

const FAB_MIN_Y = 100;

export function getAnchoredFabTranslationX(
  windowWidth: number,
  isOnRight: boolean
) {
  if (isOnRight) {
    return 0;
  }

  return EDGE_MARGIN - (windowWidth - FAB_SIZE - EDGE_MARGIN);
}

export function getClampedFabTranslationY(
  previousStartY: number,
  nextWindowHeight: number,
  nextBottomOffset: number,
  currentTranslationY: number
) {
  const nextStartY = nextWindowHeight - nextBottomOffset - FAB_SIZE;
  const maxY = nextWindowHeight - nextBottomOffset - FAB_SIZE;
  const absoluteY = previousStartY + currentTranslationY;
  const clampedAbsoluteY = Math.max(FAB_MIN_Y, Math.min(absoluteY, maxY));

  return clampedAbsoluteY - nextStartY;
}
