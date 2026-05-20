import { describe, expect, it } from '@jest/globals';
import { darkTheme, lightTheme } from './themes';
import { contrastRatio } from './wcagContrast';

function expectTokenContrast(
  tokenName: string,
  token: string,
  background: string
) {
  const ratio = contrastRatio(token, background);
  expect({ ratio, token, tokenName, valid: ratio >= 4.5 }).toMatchObject({
    valid: true,
  });
}

describe('theme contrast tokens', () => {
  it('flags intentionally low contrast colors below the AA threshold', () => {
    // These near-background values document the contrastRatio helper rejecting decorative-only colors for text/interactive use.
    expect(contrastRatio('#F9FAFB', lightTheme.background)).toBeLessThan(4.5);
    expect(contrastRatio('#111827', darkTheme.background)).toBeLessThan(4.5);
  });

  it('keeps legacy light text and icon tokens at WCAG AA contrast', () => {
    const tokens = [
      ['text', lightTheme.text],
      ['textSecondary', lightTheme.textSecondary],
      ['placeholder', lightTheme.placeholder],
      ['tint', lightTheme.tint],
      ['icon', lightTheme.icon],
      ['tabIconDefault', lightTheme.tabIconDefault],
      ['tabIconSelected', lightTheme.tabIconSelected],
    ] as const;

    for (const [name, token] of tokens) {
      expectTokenContrast(`light.${name}`, token, lightTheme.background);
    }
  });

  it('keeps legacy dark text and icon tokens at WCAG AA contrast', () => {
    const tokens = [
      ['text', darkTheme.text],
      ['textSecondary', darkTheme.textSecondary],
      ['placeholder', darkTheme.placeholder],
      ['tint', darkTheme.tint],
      ['icon', darkTheme.icon],
      ['tabIconDefault', darkTheme.tabIconDefault],
      ['tabIconSelected', darkTheme.tabIconSelected],
    ] as const;

    for (const [name, token] of tokens) {
      expectTokenContrast(`dark.${name}`, token, darkTheme.background);
    }
  });
});
