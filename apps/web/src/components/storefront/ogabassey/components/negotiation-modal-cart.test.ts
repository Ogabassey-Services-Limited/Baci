import { describe, expect, it } from 'vitest';
import type { CartItem } from '@/hooks/cart';
import {
  deriveCartLineNegotiationProps,
  toNegotiationCartLine,
} from './negotiation-modal-cart';

const baseItem = {
  id: 'product-1',
  cartItemId: 'cart-1',
  name: 'Galaxy S24',
  description: 'Phone',
  status: 'active',
  price: 900_000,
  negotiatedPrice: 850_000,
  manage_stock: true,
  stock: 4,
  quantity: 1,
  image: '/s24.jpg',
  imageLarge: '/s24.jpg',
  imageHint: 'phone',
  brand: 'Samsung',
  gtin: '',
  mpn: '',
  slug: 'galaxy-s24',
  variantId: 'variant-blue-256',
  variantAttributes: { color: 'Blue' },
  selectedColor: 'Blue',
  selectedStorage: '256GB',
  condition: 'new',
} satisfies CartItem;

function createItem(overrides: Partial<CartItem> = {}): CartItem {
  return { ...baseItem, ...overrides };
}

describe('negotiation modal cart helpers', () => {
  it('folds cart variant selections into single-offer props without duplicates', () => {
    expect(deriveCartLineNegotiationProps(baseItem)).toEqual({
      condition: 'new',
      itemId: 'cart-1',
      productBrand: 'Samsung',
      productSlug: 'galaxy-s24',
      variantAttributes: {
        color: 'Blue',
        Storage: '256GB',
      },
      variantId: 'variant-blue-256',
    });
  });

  it('maps cart lines into negotiation snapshots with negotiated prices', () => {
    expect(toNegotiationCartLine(baseItem)).toMatchObject({
      brand: 'Samsung',
      condition: 'new',
      image: '/s24.jpg',
      name: 'Galaxy S24',
      price: 850_000,
      product_id: 'product-1',
      quantity: 1,
      variant_id: 'variant-blue-256',
      variant_name: 'color: Blue · Storage: 256GB',
    });
  });

  it('dedupes overlapping variant attributes and explicit selections', () => {
    const item = createItem({
      selectedColor: 'Blue',
      selectedStorage: '256GB',
      variantAttributes: {
        Color: 'Blue',
        Storage: '256GB',
      },
    });

    expect(deriveCartLineNegotiationProps(item).variantAttributes).toEqual({
      Color: 'Blue',
      Storage: '256GB',
    });
    expect(toNegotiationCartLine(item).variant_name).toBe(
      'Color: Blue · Storage: 256GB'
    );
  });

  it('keeps option details when a cart line has no concrete variant id', () => {
    const item = createItem({
      selectedColor: undefined,
      selectedStorage: undefined,
      variantId: undefined,
      variantAttributes: { RAM: '12GB' },
    });

    expect(deriveCartLineNegotiationProps(item)).toMatchObject({
      variantAttributes: { RAM: '12GB' },
      variantId: undefined,
    });
    expect(toNegotiationCartLine(item)).toMatchObject({
      variant_id: undefined,
      variant_name: 'RAM: 12GB',
    });
  });

  it('omits variant metadata when no variant selections exist', () => {
    const item = createItem({
      secondaryColor: undefined,
      selectedColor: undefined,
      selectedStorage: undefined,
      variantAttributes: {},
      variantId: undefined,
    });

    expect(deriveCartLineNegotiationProps(item)).toMatchObject({
      variantAttributes: undefined,
      variantId: undefined,
    });
    expect(toNegotiationCartLine(item)).toMatchObject({
      variant_id: undefined,
      variant_name: undefined,
    });
  });
});
