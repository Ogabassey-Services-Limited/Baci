import { describe, expect, it } from '@jest/globals';
import { getFirstImageIndexForColor } from './get-first-image-index-for-color';

describe('getFirstImageIndexForColor', () => {
  it('uses the first mapped color image when it is available in the gallery', () => {
    expect(
      getFirstImageIndexForColor({
        color: ' Gold ',
        colorImages: {
          Gold: ['https://cdn.example.com/gold.jpg'],
        },
        images: [
          'https://cdn.example.com/black.jpg',
          'https://cdn.example.com/gold.jpg',
        ],
      })
    ).toBe(1);
  });

  it('falls back to the first gallery image for missing color inputs', () => {
    expect(
      getFirstImageIndexForColor({
        color: null,
        colorImages: {
          Gold: ['https://cdn.example.com/gold.jpg'],
        },
        images: ['https://cdn.example.com/gold.jpg'],
      })
    ).toBe(0);

    expect(
      getFirstImageIndexForColor({
        color: undefined,
        images: ['https://cdn.example.com/gold.jpg'],
      })
    ).toBe(0);

    expect(
      getFirstImageIndexForColor({
        color: '   ',
        images: ['https://cdn.example.com/gold.jpg'],
      })
    ).toBe(0);
  });

  it('falls back to zero when the mapped image is not in the gallery', () => {
    expect(
      getFirstImageIndexForColor({
        color: 'Silver',
        colorImages: {
          Silver: ['https://cdn.example.com/silver.jpg'],
        },
        images: [],
      })
    ).toBe(0);

    expect(
      getFirstImageIndexForColor({
        color: 'Gold',
        images: ['https://cdn.example.com/gold.jpg'],
      })
    ).toBe(0);
  });
});
