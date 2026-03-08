import { describe, expect, it } from 'vitest';
import { prioritizeSmartphoneProducts } from './prioritize-smartphone-products';

describe('prioritizeSmartphoneProducts', () => {
  it('moves smartphone categories ahead of other categories while preserving relative order', () => {
    const sorted = prioritizeSmartphoneProducts([
      { id: 'tv-1', category: 'Smart TVs' },
      { id: 'phone-1', category: 'Smartphones' },
      { id: 'laptop-1', category: 'Laptops' },
      { id: 'phone-2', category: 'Mobile Phones' },
    ]);

    expect(sorted.map((product) => product.id)).toEqual([
      'phone-1',
      'phone-2',
      'tv-1',
      'laptop-1',
    ]);
  });

  it('does not treat headphone categories as smartphones', () => {
    const sorted = prioritizeSmartphoneProducts([
      { id: 'audio-1', category: 'Headphones' },
      { id: 'phone-1', category: 'Phones' },
    ]);

    expect(sorted.map((product) => product.id)).toEqual([
      'phone-1',
      'audio-1',
    ]);
  });
});
