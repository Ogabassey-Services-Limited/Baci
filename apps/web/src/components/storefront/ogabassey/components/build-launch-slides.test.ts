import { describe, expect, it } from 'vitest';
import type { Product as OgabasseyProduct } from '../types';
import { buildLaunchSlides } from './build-launch-slides';

const baseProduct = (overrides: Partial<OgabasseyProduct>): OgabasseyProduct => ({
  id: 'p1',
  name: 'Product',
  price: '₦1,000',
  image: 'https://cdn.ogabassey.com/core-assets/products/p1.avif',
  description: '',
  categorySlug: 'smartphones',
  category: 'Smartphones',
  brand: 'Brand',
  ...overrides,
});

describe('buildLaunchSlides', () => {
  it('builds a basePath-joined PDP href that contains the product slug', () => {
    const slides = buildLaunchSlides(
      [baseProduct({ id: 'a', slug: 'samsung-galaxy-a27-5g' })],
      '/ogabassey'
    );

    expect(slides).toHaveLength(1);
    expect(slides[0].href.startsWith('/ogabassey/')).toBe(true);
    expect(slides[0].href).toContain('samsung-galaxy-a27-5g');
  });

  it('uses a pre-order CTA label for pre-order products and Shop now otherwise', () => {
    const slides = buildLaunchSlides(
      [
        baseProduct({
          id: 'a',
          slug: 'samsung-galaxy-a27-5g',
          name: 'Samsung Galaxy A27 5G Preorder',
        }),
        baseProduct({ id: 'b', slug: 'itel-power-80', name: 'Itel Power 80' }),
      ],
      ''
    );

    expect(slides[0].ctaLabel).toBe('Pre-order now');
    expect(slides[1].ctaLabel).toBe('Shop now');
  });

  it('prefers image_alt, falling back to "name — brand"', () => {
    const [withAlt, withoutAlt] = buildLaunchSlides(
      [
        baseProduct({ id: 'a', slug: 'a27', image_alt: 'Curated alt text' }),
        baseProduct({
          id: 'b',
          slug: 'power80',
          name: 'Itel Power 80',
          brand: 'Itel',
          image_alt: null,
        }),
      ],
      ''
    );

    expect(withAlt.imageAlt).toBe('Curated alt text');
    expect(withoutAlt.imageAlt).toBe('Itel Power 80 — Itel');
  });

  it('skips products missing a slug or an image (cannot be linked/rendered)', () => {
    const slides = buildLaunchSlides(
      [
        baseProduct({ id: 'a', slug: undefined }),
        baseProduct({ id: 'b', slug: 'has-slug', image: '' }),
        baseProduct({ id: 'c', slug: 'ok' }),
      ],
      ''
    );

    expect(slides.map((s) => s.id)).toEqual(['c']);
  });

  it('passes through the pre-formatted price label and marks slides as product', () => {
    const [slide] = buildLaunchSlides(
      [baseProduct({ id: 'a', slug: 'a27', price: '₦50,000' })],
      ''
    );

    expect(slide.kind).toBe('product');
    expect(slide.priceLabel).toBe('₦50,000');
  });
});
