import { describe, expect, it } from 'vitest';
import type { Product } from '../../types';
import {
  normalizeProductDetails,
  resolveCurrentOffer,
} from './product-details-helpers';

describe('product details helpers', () => {
  it('normalizes mixed inventory conditions to new', () => {
    const result = normalizeProductDetails({
      id: 'product-1',
      name: 'Test Product',
      price: '1000',
      image: '/placeholder.svg',
      description: '',
      condition: 'New & Used',
      images: [],
      colors: [],
      storage: [],
    } as Product);

    expect(result.condition).toBe('new');
  });

  it('formats current offers with locale-aware NGN currency', () => {
    const product = normalizeProductDetails({
      id: 'product-2',
      name: 'Offer Product',
      price: '₦125000',
      rawPrice: 125000,
      image: '/placeholder.svg',
      description: '',
      condition: 'new',
      images: [],
      colors: [],
      storage: [],
    } as Product);

    const offer = resolveCurrentOffer(product, 'new', {});

    expect(offer.price).toBe('₦125,000');
    expect(offer.rawPrice).toBe(125000);
  });
});
