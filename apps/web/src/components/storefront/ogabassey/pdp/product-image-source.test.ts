import { describe, expect, it } from 'vitest';
import { buildOgabasseyPdpMobileImageSrcSet } from './product-image-source';

describe('buildOgabasseyPdpMobileImageSrcSet', () => {
  it('caps mobile PDP LCP candidates at the measured mobile width budget', () => {
    const src =
      'https://cdn.ogabassey.com/core-assets/products/gaming/nintendo-switch-hotel-transylvania.avif';

    const srcSet = buildOgabasseyPdpMobileImageSrcSet(src);

    expect(srcSet).toContain(
      'https://cdn.ogabassey.com/image/width=750,quality=30,format=jpeg/core-assets/products/gaming/nintendo-switch-hotel-transylvania.avif 750w'
    );
    expect(srcSet).toContain(
      'https://cdn.ogabassey.com/image/width=640,quality=30,format=jpeg/core-assets/products/gaming/nintendo-switch-hotel-transylvania.avif 640w'
    );
    expect(srcSet).not.toContain('format=auto');
    expect(srcSet).not.toContain('828w');
    expect(srcSet).not.toContain('1080w');
  });

  it('keeps the cap for non-CDN image loader URL shapes', () => {
    const src = 'https://assets.example.com/products/demo-product.png';

    const srcSet = buildOgabasseyPdpMobileImageSrcSet(src);

    expect(srcSet).toContain(
      'https://assets.example.com/products/demo-product.png?w=750&q=30 750w'
    );
    expect(srcSet).toContain(
      'https://assets.example.com/products/demo-product.png?w=640&q=30 640w'
    );
    expect(srcSet).not.toContain('828w');
    expect(srcSet).not.toContain('1080w');
  });
});
