import { describe, expect, it } from 'vitest';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
  ogabasseyPdpPrimaryImageLoader,
} from '@/components/storefront/ogabassey/config/product-media';

describe('OgaBassey PDP product media config', () => {
  it('keeps PDP image sizing aligned to the storefront gallery layout', () => {
    expect(OGABASSEY_PDP_PRIMARY_IMAGE_SIZES).toBe(
      '(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc(100vw - 48px), (max-width: 1439px) 40vw, 560px',
    );
    expect(OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY).toBe(35);
    expect(OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH).toBe(640);
  });

  it('caps mobile high-DPR CDN transform requests without falsifying sizes', () => {
    expect(
      ogabasseyPdpPrimaryImageLoader({
        src: 'https://cdn.ogabassey.com/products/phone.jpg',
        width: 1080,
        quality: 35,
      }),
    ).toContain('/image/width=750,quality=35,format=auto/products/phone.jpg');
    expect(
      ogabasseyPdpPrimaryImageLoader({
        src: 'https://cdn.ogabassey.com/products/phone.jpg',
        width: 1200,
        quality: 35,
      }),
    ).toContain('/image/width=1200,quality=35,format=auto/products/phone.jpg');
  });
});
