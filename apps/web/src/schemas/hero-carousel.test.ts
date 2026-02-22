import { describe, expect, it } from 'vitest';
import {
  heroCarouselSlideSchema,
  heroCarouselUpdateRequestSchema,
} from './hero-carousel';

describe('heroCarouselSlideSchema', () => {
  it('parses a complete slide', () => {
    const result = heroCarouselSlideSchema.parse({
      id: 'slide-1',
      imageUrl: 'https://example.com/hero.jpg',
      headline: 'Summer Sale',
      description: 'Up to 50% off',
      cta: 'Shop Now',
      link: '/category/summer',
    });

    expect(result).toEqual({
      id: 'slide-1',
      imageUrl: 'https://example.com/hero.jpg',
      headline: 'Summer Sale',
      description: 'Up to 50% off',
      cta: 'Shop Now',
      link: '/category/summer',
    });
  });

  it('applies defaults for omitted optional fields', () => {
    const result = heroCarouselSlideSchema.parse({});

    expect(result).toEqual({
      imageUrl: '',
      headline: '',
      description: '',
      cta: '',
      link: '/category/all',
    });
  });

  it('trims whitespace from strings', () => {
    const result = heroCarouselSlideSchema.parse({
      headline: '  Padded Title  ',
      cta: '  Click Me  ',
    });

    expect(result.headline).toBe('Padded Title');
    expect(result.cta).toBe('Click Me');
  });

  it('rejects headline exceeding 120 characters', () => {
    const result = heroCarouselSlideSchema.safeParse({
      headline: 'x'.repeat(121),
    });

    expect(result.success).toBe(false);
  });

  it('rejects description exceeding 280 characters', () => {
    const result = heroCarouselSlideSchema.safeParse({
      description: 'x'.repeat(281),
    });

    expect(result.success).toBe(false);
  });

  it('rejects cta exceeding 60 characters', () => {
    const result = heroCarouselSlideSchema.safeParse({
      cta: 'x'.repeat(61),
    });

    expect(result.success).toBe(false);
  });

  it('rejects imageUrl exceeding 2048 characters', () => {
    const result = heroCarouselSlideSchema.safeParse({
      imageUrl: `https://example.com/${'x'.repeat(2048)}`,
    });

    expect(result.success).toBe(false);
  });

  it('rejects id exceeding 100 characters', () => {
    const result = heroCarouselSlideSchema.safeParse({
      id: 'x'.repeat(101),
    });

    expect(result.success).toBe(false);
  });

  it('rejects empty id string', () => {
    const result = heroCarouselSlideSchema.safeParse({
      id: '',
    });

    expect(result.success).toBe(false);
  });
});

describe('heroCarouselUpdateRequestSchema', () => {
  it('parses a valid request with slides', () => {
    const result = heroCarouselUpdateRequestSchema.parse({
      slides: [{ headline: 'Slide 1' }, { headline: 'Slide 2' }],
    });

    expect(result.slides).toHaveLength(2);
  });

  it('accepts an empty slides array', () => {
    const result = heroCarouselUpdateRequestSchema.parse({ slides: [] });

    expect(result.slides).toEqual([]);
  });

  it('rejects more than 12 slides', () => {
    const slides = Array.from({ length: 13 }, (_, i) => ({
      headline: `Slide ${i}`,
    }));

    const result = heroCarouselUpdateRequestSchema.safeParse({ slides });

    expect(result.success).toBe(false);
  });

  it('accepts exactly 12 slides', () => {
    const slides = Array.from({ length: 12 }, (_, i) => ({
      headline: `Slide ${i}`,
    }));

    const result = heroCarouselUpdateRequestSchema.safeParse({ slides });

    expect(result.success).toBe(true);
  });

  it('rejects missing slides field', () => {
    const result = heroCarouselUpdateRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
