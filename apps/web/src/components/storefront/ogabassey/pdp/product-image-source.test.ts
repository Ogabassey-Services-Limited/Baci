import { describe, expect, it } from 'vitest';
import { buildOgabasseyPdpMobileImageSrcSet } from './product-image-source';

describe('buildOgabasseyPdpMobileImageSrcSet', () => {
  it('caps mobile PDP LCP candidates at the measured mobile width budget', () => {
    const src =
      'https://cdn.ogabassey.com/core-assets/products/gaming/nintendo-switch-hotel-transylvania.avif';

    const srcSet = buildOgabasseyPdpMobileImageSrcSet(src);

    expect(srcSet).toContain(`${src} 750w`);
    expect(srcSet).toContain(`${src} 640w`);
    expect(srcSet).not.toContain('/image/width=');
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
