import { describe, expect, it } from 'vitest';
import { ReviewsSection } from './reviews-section';

describe('ReviewsSection', () => {
  it('exports a valid component', () => {
    expect(ReviewsSection).toBeDefined();
    expect(typeof ReviewsSection).toBe('function');
  });
});
