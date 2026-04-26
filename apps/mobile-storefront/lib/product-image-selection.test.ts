import { describe, expect, it } from '@jest/globals';
import { resolveVariantSelectionFromImage } from './product-image-selection';

describe('resolveVariantSelectionFromImage', () => {
  it('returns null when the tapped image is empty', () => {
    expect(
      resolveVariantSelectionFromImage({
        imageUrl: '  ',
        variants: [],
      })
    ).toBeNull();
  });

  it('returns null when the tapped image does not match any variant', () => {
    expect(
      resolveVariantSelectionFromImage({
        imageUrl: 'https://cdn.example.com/missing.jpg',
        variants: [
          {
            id: 'used-gold-64',
            condition: 'used',
            price: 470000,
            price_override: 470000,
            stock_quantity: 0,
            image: 'https://cdn.example.com/i11pm-gold.jpg',
            images: ['https://cdn.example.com/i11pm-gold.jpg'],
            attributes: { color: 'Gold', storage: '64GB' },
            name: '64GB Gold',
          },
        ],
      })
    ).toBeNull();
  });

  it('returns null when there are no variants to resolve', () => {
    expect(
      resolveVariantSelectionFromImage({
        imageUrl: 'https://cdn.example.com/i11pm-gold.jpg',
        variants: [],
      })
    ).toBeNull();
  });

  it('resolves the canonical color from the tapped image while preserving condition and storage', () => {
    expect(
      resolveVariantSelectionFromImage({
        imageUrl: 'https://cdn.example.com/i11pm-gold.jpg',
        selectedCondition: 'used',
        selectedStorage: '64GB',
        variants: [
          {
            id: 'ob-gold-64',
            condition: 'open_box',
            price: 520000,
            price_override: 520000,
            stock_quantity: 2,
            image: 'https://cdn.example.com/i11pm-gold.jpg',
            images: ['https://cdn.example.com/i11pm-gold.jpg'],
            attributes: { color: 'Gold', storage: '64GB' },
            name: '64GB Gold',
          },
          {
            id: 'used-gold-64',
            condition: 'used',
            price: 470000,
            price_override: 470000,
            stock_quantity: 5,
            image: 'https://cdn.example.com/i11pm-gold.jpg',
            images: ['https://cdn.example.com/i11pm-gold.jpg'],
            attributes: { color: 'Gold', storage: '64GB' },
            name: '64GB Gold',
          },
        ],
      })
    ).toEqual({
      color: 'Gold',
      variantId: 'used-gold-64',
    });
  });

  it('uses the requested storage to pick the matching row when variants share the same image', () => {
    expect(
      resolveVariantSelectionFromImage({
        imageUrl: 'https://cdn.example.com/i11pm-gold.jpg',
        selectedStorage: '256GB',
        variants: [
          {
            id: 'used-gold-64',
            condition: 'used',
            price: 470000,
            price_override: 470000,
            stock_quantity: 5,
            image: 'https://cdn.example.com/i11pm-gold.jpg',
            images: ['https://cdn.example.com/i11pm-gold.jpg'],
            attributes: { color: 'Gold', storage: '64GB' },
            name: '64GB Gold',
          },
          {
            id: 'used-gold-256',
            condition: 'used',
            price: 550000,
            price_override: 550000,
            stock_quantity: 2,
            image: 'https://cdn.example.com/i11pm-gold.jpg',
            images: ['https://cdn.example.com/i11pm-gold.jpg'],
            attributes: { color: 'Gold', storage: '256GB' },
            name: '256GB Gold',
          },
        ],
      })
    ).toEqual({
      color: 'Gold',
      variantId: 'used-gold-256',
    });
  });

  it('matches legacy colour attributes when filtering by selected attributes', () => {
    expect(
      resolveVariantSelectionFromImage({
        imageUrl: 'https://cdn.example.com/i11pm-crimson.jpg',
        selectedAttributes: { colour: 'Crimson' },
        variants: [
          {
            id: 'used-crimson-64',
            condition: 'used',
            price: 470000,
            price_override: 470000,
            stock_quantity: 2,
            image: 'https://cdn.example.com/i11pm-crimson.jpg',
            images: ['https://cdn.example.com/i11pm-crimson.jpg'],
            attributes: { colour: 'Crimson', storage: '64GB' },
            name: '64GB Crimson',
          },
          {
            id: 'used-green-64',
            condition: 'used',
            price: 470000,
            price_override: 470000,
            stock_quantity: 2,
            image: 'https://cdn.example.com/i11pm-crimson.jpg',
            images: ['https://cdn.example.com/i11pm-crimson.jpg'],
            attributes: { colour: 'Forest Green', storage: '64GB' },
            name: '64GB Forest Green',
          },
        ],
      })
    ).toEqual({
      color: 'Crimson',
      variantId: 'used-crimson-64',
    });
  });

  it('falls back to the image-matched color when condition-specific rows are unavailable', () => {
    expect(
      resolveVariantSelectionFromImage({
        imageUrl: 'https://cdn.example.com/i11pm-space-gray.jpg',
        selectedCondition: 'used',
        selectedStorage: '64GB',
        variants: [
          {
            id: 'ob-space-gray-64',
            condition: 'open_box',
            price: 520000,
            price_override: 520000,
            stock_quantity: 4,
            image: 'https://cdn.example.com/i11pm-space-gray.jpg',
            images: ['https://cdn.example.com/i11pm-space-gray.jpg'],
            attributes: { color: 'Space Gray', storage: '64GB' },
            name: '64GB Space Gray',
          },
        ],
      })
    ).toEqual({
      color: 'Space Gray',
      variantId: 'ob-space-gray-64',
    });
  });

  it('prefers purchasable variants when a shared image maps to in-stock and out-of-stock rows', () => {
    expect(
      resolveVariantSelectionFromImage({
        imageUrl: 'https://cdn.example.com/i11pm-gold.jpg',
        selectedCondition: 'used',
        selectedStorage: '64GB',
        variants: [
          {
            id: 'used-gold-64-sold-out',
            condition: 'used',
            price: 470000,
            price_override: 470000,
            stock_quantity: 0,
            image: 'https://cdn.example.com/i11pm-gold.jpg',
            images: ['https://cdn.example.com/i11pm-gold.jpg'],
            attributes: { color: 'Gold', storage: '64GB' },
            name: '64GB Gold (Sold Out)',
          },
          {
            id: 'used-gold-64-available',
            condition: 'used',
            price: 470000,
            price_override: 470000,
            stock_quantity: 3,
            image: 'https://cdn.example.com/i11pm-gold.jpg',
            images: ['https://cdn.example.com/i11pm-gold.jpg'],
            attributes: { color: 'Gold', storage: '64GB' },
            name: '64GB Gold',
          },
        ],
      })
    ).toEqual({
      color: 'Gold',
      variantId: 'used-gold-64-available',
    });
  });

  it('returns a null variantId when every image match is out of stock', () => {
    expect(
      resolveVariantSelectionFromImage({
        imageUrl: 'https://cdn.example.com/i11pm-gold.jpg',
        selectedCondition: 'used',
        selectedStorage: '64GB',
        variants: [
          {
            id: 'used-gold-64-sold-out',
            condition: 'used',
            price: 470000,
            price_override: 470000,
            stock_quantity: 0,
            image: 'https://cdn.example.com/i11pm-gold.jpg',
            images: ['https://cdn.example.com/i11pm-gold.jpg'],
            attributes: { color: 'Gold', storage: '64GB' },
            name: '64GB Gold (Sold Out)',
          },
        ],
      })
    ).toEqual({
      color: 'Gold',
      variantId: null,
    });
  });

  it('treats every variant as purchasable when manage_stock is false', () => {
    expect(
      resolveVariantSelectionFromImage({
        imageUrl: 'https://cdn.example.com/i11pm-gold.jpg',
        manageStock: false,
        selectedCondition: 'used',
        selectedStorage: '64GB',
        variants: [
          {
            id: 'used-gold-64-sold-out',
            condition: 'used',
            price: 470000,
            price_override: 470000,
            stock_quantity: 0,
            image: 'https://cdn.example.com/i11pm-gold.jpg',
            images: ['https://cdn.example.com/i11pm-gold.jpg'],
            attributes: { color: 'Gold', storage: '64GB' },
            name: '64GB Gold (Sold Out)',
          },
        ],
      })
    ).toEqual({
      color: 'Gold',
      variantId: 'used-gold-64-sold-out',
    });
  });

  it('ignores stale hidden color axes from the previously selected color', () => {
    expect(
      resolveVariantSelectionFromImage({
        imageUrl: 'https://cdn.example.com/i11pm-gold.jpg',
        selectedAttributes: {
          color_hex: '#54524F',
        },
        selectedCondition: 'used',
        selectedStorage: '64GB',
        variants: [
          {
            id: 'ob-gold-64',
            condition: 'open_box',
            price: 520000,
            price_override: 520000,
            stock_quantity: 2,
            image: 'https://cdn.example.com/i11pm-gold.jpg',
            images: ['https://cdn.example.com/i11pm-gold.jpg'],
            attributes: {
              color: 'Gold',
              storage: '64GB',
              color_hex: '#F5D4A3',
            },
            name: '64GB Gold',
          },
          {
            id: 'used-gold-64',
            condition: 'used',
            price: 470000,
            price_override: 470000,
            stock_quantity: 3,
            image: 'https://cdn.example.com/i11pm-gold.jpg',
            images: ['https://cdn.example.com/i11pm-gold.jpg'],
            attributes: {
              color: 'Gold',
              storage: '64GB',
              color_hex: '#F5D4A3',
            },
            name: '64GB Gold',
          },
        ],
      })
    ).toEqual({
      color: 'Gold',
      variantId: 'used-gold-64',
    });
  });
});
