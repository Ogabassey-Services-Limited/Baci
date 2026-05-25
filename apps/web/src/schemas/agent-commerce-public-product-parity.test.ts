import { describe, expect, it } from 'vitest';
import {
  publicProductApiResponseSchema,
  publicProductComparableSurfaceSchema,
  publicProductCurrentFeedItemSchema,
  publicProductGoogleFeedItemSchema,
  publicProductPdpSchema,
} from './agent-commerce-public-product-parity';

const apiProduct = {
  availability: 'in_stock',
  has_condition_offers: false,
  has_variants: false,
  id: 'product-1',
  image: '',
  name: 'Test Phone',
  price: 1000,
};
const surface = {
  availability: 'in_stock',
  image: '/media/phone.jpg',
  name: 'Test Phone',
  price: 1000,
  url: 'https://ogabassey.com/phones/test-phone',
};

describe('public product parity schemas', () => {
  it('accepts API image comparison values while enforcing identity and availability', () => {
    expect(
      publicProductApiResponseSchema.safeParse({ products: [apiProduct] })
        .success
    ).toBe(true);
    expect(
      publicProductApiResponseSchema.safeParse({
        products: [{ ...apiProduct, availability: 'unknown' }],
      }).success
    ).toBe(false);
    expect(
      publicProductApiResponseSchema.safeParse({
        products: [{ ...apiProduct, id: '' }],
      }).success
    ).toBe(false);
  });

  it('validates comparable surface and feed navigation contracts', () => {
    expect(
      publicProductComparableSurfaceSchema.safeParse(surface).success
    ).toBe(true);
    expect(
      publicProductComparableSurfaceSchema.safeParse({
        ...surface,
        url: 'not-a-url',
      }).success
    ).toBe(false);
    expect(
      publicProductCurrentFeedItemSchema.safeParse({
        id: 'product-1',
        media: [{ url: '' }],
        title: surface.name,
        url: surface.url,
        variants: [
          { availability: { status: 'in_stock' }, price: { amount: 1000 } },
        ],
      }).success
    ).toBe(true);
    expect(
      publicProductCurrentFeedItemSchema.safeParse({
        id: 'product-1',
        media: [],
        title: surface.name,
        url: surface.url,
        variants: [],
      }).success
    ).toBe(false);
    expect(
      publicProductGoogleFeedItemSchema.safeParse({
        availability: 'out_of_stock',
        id: 'product-1',
        image_link: '',
        link: surface.url,
        price: '1000 NGN',
        title: surface.name,
      }).success
    ).toBe(true);
    expect(
      publicProductGoogleFeedItemSchema.safeParse({
        availability: 'out_of_stock',
        id: 'product-1',
        image_link: '',
        link: 'not-a-url',
        price: '1000 NGN',
        title: surface.name,
      }).success
    ).toBe(false);
  });

  it('accepts relative PDP image values but requires valid offers', () => {
    const pdp = {
      '@type': 'Product',
      image: '/media/phone.jpg',
      name: surface.name,
      offers: {
        availability: 'https://schema.org/InStock',
        price: 1000,
        url: surface.url,
      },
      url: surface.url,
    };

    expect(publicProductPdpSchema.safeParse(pdp).success).toBe(true);
    expect(
      publicProductPdpSchema.safeParse({
        ...pdp,
        offers: { availability: 'https://schema.org/InStock', price: 1000 },
      }).success
    ).toBe(true);
    expect(
      publicProductPdpSchema.safeParse({ ...pdp, image: [] }).success
    ).toBe(false);
    expect(
      publicProductPdpSchema.safeParse({
        ...pdp,
        offers: { ...pdp.offers, url: 'not-a-url' },
      }).success
    ).toBe(false);
  });

  it('accepts a comparable single-variant ProductGroup but rejects ambiguous groups', () => {
    const variant = {
      '@type': 'Product',
      offers: {
        availability: 'https://schema.org/InStock',
        price: 1000,
        url: `${surface.url}?variantId=variant-1`,
      },
    };
    const group = {
      '@type': 'ProductGroup',
      hasVariant: [variant],
      image: ['/media/phone.jpg'],
      name: surface.name,
      url: surface.url,
    };

    expect(publicProductPdpSchema.safeParse(group).success).toBe(true);
    expect(
      publicProductPdpSchema.safeParse({
        ...group,
        hasVariant: [
          variant,
          {
            ...variant,
            offers: {
              ...variant.offers,
              url: `${surface.url}?variantId=variant-2`,
            },
          },
        ],
      }).success
    ).toBe(false);
  });
});
