import { describe, expect, it } from 'vitest';
import { normalizeProductImages } from './product-mappers';

describe('normalizeProductImages', () => {
  it('normalizes string and object image entries', () => {
    expect(
      normalizeProductImages('iPhone 15', [
        'https://cdn.example.com/1.jpg',
        { url: 'https://cdn.example.com/2.jpg', alt: '', order: 5 },
      ])
    ).toEqual([
      {
        url: 'https://cdn.example.com/1.jpg',
        alt: 'iPhone 15',
        order: 0,
      },
      {
        url: 'https://cdn.example.com/2.jpg',
        alt: 'iPhone 15',
        order: 5,
      },
    ]);
  });
});
