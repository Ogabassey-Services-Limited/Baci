import { describe, expect, it } from '@jest/globals';
import { resolveVariantSelectionFromImage } from './product-image-selection';

describe('resolveVariantSelectionFromImage', () => {
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
            stock_quantity: 0,
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
            stock_quantity: 0,
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
            stock_quantity: 0,
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
            stock_quantity: 0,
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
            stock_quantity: 0,
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
            stock_quantity: 0,
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
            stock_quantity: 0,
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
