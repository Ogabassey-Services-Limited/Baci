import { describe, expect, it } from '@jest/globals';
import { darkTheme, lightTheme } from './themes';
import { contrastRatio } from './wcagContrast';

describe('theme contrast tokens', () => {
  it('flags intentionally low contrast colors below the AA threshold', () => {
    // These near-background values document the contrastRatio helper rejecting decorative-only colors for text/interactive use.
    expect(contrastRatio('#F9FAFB', lightTheme.background)).toBeLessThan(4.5);
    expect(contrastRatio('#111827', darkTheme.background)).toBeLessThan(4.5);
  });

  it('keeps legacy light text and icon tokens at WCAG AA contrast', () => {
    const tokens = [
      lightTheme.text,
      lightTheme.textSecondary,
      lightTheme.placeholder,
      lightTheme.tint,
      lightTheme.icon,
      lightTheme.tabIconDefault,
      lightTheme.tabIconSelected,
    ];

    for (const token of tokens) {
      expect(
        contrastRatio(token, lightTheme.background)
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps legacy dark text and icon tokens at WCAG AA contrast', () => {
    const tokens = [
      darkTheme.text,
      darkTheme.textSecondary,
      darkTheme.placeholder,
      darkTheme.tint,
      darkTheme.icon,
      darkTheme.tabIconDefault,
      darkTheme.tabIconSelected,
    ];

    for (const token of tokens) {
      expect(contrastRatio(token, darkTheme.background)).toBeGreaterThanOrEqual(
        4.5
      );
    }
  });
});
