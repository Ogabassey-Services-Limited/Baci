import { describe, expect, it } from 'vitest';
import { isCameraLikeCategory } from './spec-camera-classifier';

describe('isCameraLikeCategory', () => {
  it('recognizes camera families and slug forms', () => {
    for (const category of [
      'Cameras',
      'Camera Accessories',
      'instant-film',
      'memory-cards',
      'tripod-stands',
    ]) {
      expect(isCameraLikeCategory(category)).toBe(true);
    }
  });

  it('does not classify ordinary device accessories as cameras', () => {
    expect(isCameraLikeCategory('Smartphone Cases')).toBe(false);
    expect(isCameraLikeCategory('Laptop Keyboard')).toBe(false);
  });
});
