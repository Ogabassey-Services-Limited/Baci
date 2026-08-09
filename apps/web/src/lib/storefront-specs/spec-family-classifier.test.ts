import { describe, expect, it } from 'vitest';
import { getProductSpecFamily } from './spec-family-classifier';

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
      expect(getProductSpecFamily(category)).toBe('camera');
    }
  });

  it('does not classify ordinary device accessories as cameras', () => {
    expect(getProductSpecFamily('Phone Accessories')).toBe('general');
    expect(getProductSpecFamily('Laptop Keyboard')).toBe('general');
    expect(getProductSpecFamily('Smartwatch Bands')).toBe('general');
    expect(getProductSpecFamily('Watch Straps')).toBe('general');
    expect(getProductSpecFamily('Screen Protectors')).toBe('general');
    expect(getProductSpecFamily('Gaming Grip')).toBe('general');
    expect(getProductSpecFamily('Camera Grip')).toBe('camera');
  });

  it('covers mobile, computer, and undefined category fallbacks', () => {
    expect(getProductSpecFamily('Smartphones')).toBe('mobile');
    expect(getProductSpecFamily('Camera Phones')).toBe('mobile');
    expect(getProductSpecFamily('Laptops')).toBe('computer');
    expect(getProductSpecFamily(undefined)).toBe('general');
  });

  it('normalizes google-pixel slugs without promoting genuine accessories', () => {
    expect(getProductSpecFamily('google-pixel')).toBe('mobile');
    expect(getProductSpecFamily('google_pixel')).toBe('mobile');
    expect(getProductSpecFamily('google-pixel-cases')).toBe('general');
    expect(getProductSpecFamily('google_pixel_accessories')).toBe('general');
  });
});
