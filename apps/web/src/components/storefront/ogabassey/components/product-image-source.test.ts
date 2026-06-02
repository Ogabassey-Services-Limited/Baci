import { describe, expect, it } from 'vitest';
import { resolveProductImageSource } from './product-image-source';

describe('resolveProductImageSource', () => {
  it('uses the first non-blank trimmed image source', () => {
    expect(
      resolveProductImageSource(['  ', ' /phone.png '], '/placeholder.svg')
    ).toEqual({ isPlaceholder: false, src: '/phone.png' });
  });

  it('falls back to the placeholder when candidates are blank or missing', () => {
    expect(
      resolveProductImageSource([undefined, null, '   '], '/placeholder.svg')
    ).toEqual({ isPlaceholder: true, src: '/placeholder.svg' });
  });
});
