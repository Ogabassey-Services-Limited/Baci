import { describe, expect, it } from 'vitest';
import { heroCarouselSlidePatchFields } from './hero-carousel-slide-patch-fields';

describe('heroCarouselSlidePatchFields', () => {
  it('keeps only the supported carousel slide fields available to plan schemas', () => {
    expect(Object.keys(heroCarouselSlidePatchFields)).toEqual([
      'ctaLink',
      'ctaText',
      'subtitle',
      'title',
    ]);
  });
});
