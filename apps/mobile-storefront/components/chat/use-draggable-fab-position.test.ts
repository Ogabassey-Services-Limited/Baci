import { EDGE_MARGIN, FAB_SIZE } from './constants';
import {
  getAnchoredFabTranslationX,
  getClampedFabTranslationY,
} from './use-draggable-fab-position';

describe('getAnchoredFabTranslationX', () => {
  it('keeps the right-snapped FAB at the styled right anchor', () => {
    expect(getAnchoredFabTranslationX(430, true)).toBe(0);
  });

  it('keeps the left-snapped FAB anchored after the viewport width changes', () => {
    const width = 430;
    const expectedLeftTranslation =
      EDGE_MARGIN - (width - FAB_SIZE - EDGE_MARGIN);

    expect(getAnchoredFabTranslationX(width, false)).toBe(
      expectedLeftTranslation
    );
  });

  it('clamps a dragged FAB above the new bottom bound after height changes', () => {
    expect(getClampedFabTranslationY(500, 90, 240)).toBe(0);
  });

  it('clamps a dragged FAB below the minimum top bound after height changes', () => {
    const startY = 500 - 90 - FAB_SIZE;

    expect(getClampedFabTranslationY(500, 90, -400)).toBe(100 - startY);
  });
});
