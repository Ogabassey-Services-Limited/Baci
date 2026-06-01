import { describe, expect, it } from 'vitest';
import {
  deriveProductImageData,
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

  it('derives primary image data while preserving original image payloads', () => {
    expect(
      deriveProductImageData({
        image: '',
        images: [
          { url: '/front.jpg', alt: 'Front view' },
          { url: '/back.jpg', alt: 'Back view' },
        ],
      })
    ).toEqual({
      image: '/front.jpg',
      imageAlt: 'Front view',
      imagePayloads: [
        { url: '/front.jpg', alt: 'Front view' },
        { url: '/back.jpg', alt: 'Back view' },
      ],
      images: ['/front.jpg', '/back.jpg'],
    });
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

  it('uses URL-matched payload alt for non-primary rendered images', () => {
    expect(
      getProductImageAlt(
        {
          image: '/front.jpg',
          image_alt: 'Front view',
          images: [
            { url: '/front.jpg', alt: 'Front payload' },
            { url: '/back.jpg', alt: 'Back view' },
          ],
          name: 'Phone',
        },
        { renderedImageUrl: '/back.jpg' }
      )
    ).toBe('Back view');
  });

  it('uses preserved payloads when rendered images are flattened URLs', () => {
    expect(
      getProductImageAlt(
        {
          image: '/front.jpg',
          image_alt: 'Front view',
          image_payloads: [
            { url: '/front.jpg', alt: 'Front payload' },
            { url: '/back.jpg', alt: 'Back view' },
          ],
          images: ['/front.jpg', '/back.jpg'],
          name: 'Phone',
        },
        { renderedImageUrl: '/back.jpg' }
      )
    ).toBe('Back view');
  });

  it('falls back to name when a non-primary image has no matched alt', () => {
    expect(
      getProductImageAlt(
        {
          image: '/front.jpg',
          image_alt: 'Front view',
          images: [{ url: '/front.jpg', alt: 'Front payload' }],
          name: 'Phone',
        },
        { renderedImageUrl: '/side.jpg' }
      )
    ).toBe('Phone');
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
