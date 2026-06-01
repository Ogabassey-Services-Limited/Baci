import { EDGE_MARGIN, FAB_SIZE } from './constants';
import { getAnchoredFabTranslationX } from './use-draggable-fab-position';

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
});
