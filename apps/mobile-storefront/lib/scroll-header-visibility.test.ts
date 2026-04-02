import { resolveScrollHeaderVisibility } from '@/lib/scroll-header-visibility';

describe('resolveScrollHeaderVisibility', () => {
  it('keeps the header visible near the top of the list', () => {
    expect(
      resolveScrollHeaderVisibility({
        currentOffsetY: 8,
        previousOffsetY: 42,
        isVisible: false,
      })
    ).toEqual({
      isVisible: true,
      previousOffsetY: 8,
    });
  });

  it('hides the header after a meaningful downward scroll', () => {
    expect(
      resolveScrollHeaderVisibility({
        currentOffsetY: 120,
        previousOffsetY: 80,
        isVisible: true,
      })
    ).toEqual({
      isVisible: false,
      previousOffsetY: 120,
    });
  });

  it('shows the header again when the user scrolls upward', () => {
    expect(
      resolveScrollHeaderVisibility({
        currentOffsetY: 140,
        previousOffsetY: 176,
        isVisible: false,
      })
    ).toEqual({
      isVisible: true,
      previousOffsetY: 140,
    });
  });

  it('ignores tiny scroll jitters', () => {
    expect(
      resolveScrollHeaderVisibility({
        currentOffsetY: 104,
        previousOffsetY: 99,
        isVisible: false,
      })
    ).toEqual({
      isVisible: false,
      previousOffsetY: 104,
    });
  });
});
