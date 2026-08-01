import { describe, expect, it } from 'vitest';
import { featuredImageVariantsEqual } from './featured-image-variants';

describe('featuredImageVariantsEqual', () => {
  it('treats semantically identical nested variant metadata as equal regardless of key order', () => {
    const persisted = {
      portrait: { height: 1600, url: 'portrait.webp', width: 900 },
      landscape: { height: 900, url: 'landscape.webp', width: 1600 },
    };
    const submitted = {
      landscape: { url: 'landscape.webp', width: 1600, height: 900 },
      portrait: { url: 'portrait.webp', height: 1600, width: 900 },
    };

    expect(featuredImageVariantsEqual(persisted, submitted)).toBe(true);
  });

  it('does not treat a changed variant URL as unchanged metadata', () => {
    expect(
      featuredImageVariantsEqual(
        { landscape: { url: 'old.webp' } },
        { landscape: { url: 'replacement.webp' } }
      )
    ).toBe(false);
  });
});
