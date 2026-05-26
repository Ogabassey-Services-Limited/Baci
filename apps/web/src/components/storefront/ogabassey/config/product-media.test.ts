import { describe, expect, it } from 'vitest';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';

describe('OgaBassey PDP product media config', () => {
  it('keeps PDP image sizing aligned to the storefront gallery layout', () => {
    expect(OGABASSEY_PDP_PRIMARY_IMAGE_SIZES).toBe(
      '(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc(100vw - 48px), (max-width: 1439px) 40vw, 560px',
    );
    expect(OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY).toBe(35);
    expect(OGABASSEY_PDP_PRIMARY_IMAGE_PRELOAD_FALLBACK_WIDTH).toBe(640);
  });
});
