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
  windowHeight: number,
  bottomOffset: number,
  currentTranslationY: number
) {
  const startY = windowHeight - bottomOffset - FAB_SIZE;
  const maxY = windowHeight - bottomOffset - FAB_SIZE;
  const absoluteY = startY + currentTranslationY;
  const clampedAbsoluteY = Math.max(FAB_MIN_Y, Math.min(absoluteY, maxY));

  return clampedAbsoluteY - startY;
}
