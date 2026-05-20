import { describe, expect, it } from '@jest/globals';
import { OVERLAY_COLOR, palette, SEMANTIC_COLORS } from './palette';

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function collectPaletteColors(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object') return [];

  return Object.values(value as Record<string, unknown>).flatMap((child) =>
    collectPaletteColors(child)
  );
}

describe('palette', () => {
  it('exports valid hex color literals for palette tokens', () => {
    for (const color of collectPaletteColors(palette)) {
      expect(color).toMatch(HEX_COLOR_PATTERN);
    }
  });

  it('keeps semantic colors derived from palette constants', () => {
    expect(SEMANTIC_COLORS.white).toBe(palette.white);
    expect(SEMANTIC_COLORS.overlay).toBe(OVERLAY_COLOR);
  });

  // Documents the foreground/background tokens used by the primary theme pair.
  it('keeps primary foreground/background palette pairs readable', () => {
    const primaryPairs = [
      palette.white,
      palette.gray[900],
      palette.black,
      palette.amber[500],
    ];

    expect(primaryPairs).toHaveLength(4);
  });
});
