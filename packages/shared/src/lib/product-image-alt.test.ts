import { describe, expect, it } from 'vitest';
import {
  getImagePayloadAlt,
  getImagePayloadUrl,
  getMatchingImagePayloadAlt,
  getProductImageAlt,
} from './product-image-alt';

describe('product image alt helpers', () => {
  it('reads URLs from strings or image payload objects', () => {
    expect(getImagePayloadUrl(' /front.jpg ')).toBe('/front.jpg');
    expect(getImagePayloadUrl({ url: ' /front.jpg ' })).toBe('/front.jpg');
    expect(getImagePayloadUrl({ url: null })).toBe('');
  });

  it('reads alt text only from image payload objects', () => {
    expect(getImagePayloadAlt({ alt: ' Front view ' })).toBe('Front view');
    expect(getImagePayloadAlt('/front.jpg')).toBe('');
    expect(getImagePayloadAlt({ alt: null })).toBe('');
  });

  it('keeps payload alt tied to the rendered image URL', () => {
    expect(
      getMatchingImagePayloadAlt(
        ['/front.jpg', { url: '/back.jpg', alt: 'Back view' }],
        '/front.jpg'
      )
    ).toBe('');
    expect(
      getMatchingImagePayloadAlt(
        ['/front.jpg', { url: '/back.jpg', alt: 'Back view' }],
        '/back.jpg'
      )
    ).toBe('Back view');
  });

  it('prefers explicit product alt text before name fallbacks', () => {
    expect(
      getProductImageAlt({
        image: '/front.jpg',
        image_alt: 'Merchant provided image alt',
        images: [{ url: '/front.jpg', alt: 'Payload alt' }],
        name: 'Phone',
      })
    ).toBe('Merchant provided image alt');
  });

  it('falls back to brand-qualified product names', () => {
    expect(
      getProductImageAlt({
        brand: 'Dell',
        image: '/front.jpg',
        name: 'XPS 16',
      })
    ).toBe('Dell XPS 16');
  });
});
