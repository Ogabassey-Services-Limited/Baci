import { EDGE_MARGIN, FAB_SIZE } from './constants';

export function getAnchoredFabTranslationX(
  windowWidth: number,
  isOnRight: boolean
) {
  if (isOnRight) {
    return 0;
  }

  return EDGE_MARGIN - (windowWidth - FAB_SIZE - EDGE_MARGIN);
}
