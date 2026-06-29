import { describe, expect, it } from 'vitest';
import { getContrastRatio } from '@/lib/color-utils';
import { OGABASSEY_DARK_TOKENS } from './dark-mode-tokens';

function expectAaContrast(
  tokenName: string,
  foreground: string,
  background: string
) {
  const ratio = getContrastRatio(foreground, background);

  expect(ratio, `${tokenName} contrast`).toBeGreaterThanOrEqual(4.5);
}

function expectLargeContrast(
  tokenName: string,
  foreground: string,
  background: string
) {
  const ratio = getContrastRatio(foreground, background);

  expect(ratio, `${tokenName} large contrast`).toBeGreaterThanOrEqual(3);
}

describe('OGABASSEY_DARK_TOKENS', () => {
  it('keeps core dark text readable on background and cards', () => {
    expectAaContrast(
      'foreground on background',
      OGABASSEY_DARK_TOKENS.foreground,
      OGABASSEY_DARK_TOKENS.background
    );
    expectAaContrast(
      'muted foreground on background',
      OGABASSEY_DARK_TOKENS.mutedForeground,
      OGABASSEY_DARK_TOKENS.background
    );
    expectAaContrast(
      'card foreground on card',
      OGABASSEY_DARK_TOKENS.cardForeground,
      OGABASSEY_DARK_TOKENS.card
    );
  });

  it('keeps action and commerce tokens readable', () => {
    expectAaContrast(
      'primary foreground on primary',
      OGABASSEY_DARK_TOKENS.primaryForeground,
      OGABASSEY_DARK_TOKENS.primary
    );
    expectAaContrast(
      'accent foreground on accent',
      OGABASSEY_DARK_TOKENS.accentForeground,
      OGABASSEY_DARK_TOKENS.accent
    );
    expectAaContrast(
      'secondary foreground on secondary',
      OGABASSEY_DARK_TOKENS.secondaryForeground,
      OGABASSEY_DARK_TOKENS.secondary
    );
    expectAaContrast(
      'success on background',
      OGABASSEY_DARK_TOKENS.success,
      OGABASSEY_DARK_TOKENS.background
    );
    expectAaContrast(
      'rating on background',
      OGABASSEY_DARK_TOKENS.rating,
      OGABASSEY_DARK_TOKENS.background
    );
    expectAaContrast(
      'price on background',
      OGABASSEY_DARK_TOKENS.price,
      OGABASSEY_DARK_TOKENS.background
    );
    expectAaContrast(
      'error on background',
      OGABASSEY_DARK_TOKENS.error,
      OGABASSEY_DARK_TOKENS.background
    );
    expectAaContrast(
      'warning on background',
      OGABASSEY_DARK_TOKENS.warning,
      OGABASSEY_DARK_TOKENS.background
    );
  });

  it('fails when a pair drops below the AA contrast threshold', () => {
    expect(() =>
      expectAaContrast('low contrast pair', '#777777', '#888888')
    ).toThrow();
  });
});
