import { describe, expect, it } from 'vitest';
import {
  getProductSpecFamily,
  isCameraLikeCategory,
} from './spec-family-classifier';

describe('spec family classifier', () => {
  it('recognizes display-name and slug forms of camera categories', () => {
    for (const category of [
      'Cameras',
      'Lenses',
      'Drones',
      'Gimbals',
      'Camera Accessories',
      'instant-film',
      'memory-cards',
      'tripod-stands',
    ]) {
      expect(isCameraLikeCategory(category)).toBe(true);
      expect(getProductSpecFamily(category)).toBe('camera');
    }
  });

  it('does not classify ordinary device accessories as cameras', () => {
    expect(isCameraLikeCategory('Smartphone Cases')).toBe(false);
    expect(getProductSpecFamily('Phone Accessories')).toBe('general');
    expect(getProductSpecFamily('Laptop Keyboard')).toBe('general');
  });
});
