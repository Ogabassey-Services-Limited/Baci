import { describe, expect, it } from 'vitest';
import { sortCategories } from './category-sorting';

describe('sortCategories', () => {
  it('should sort alphabetically by default', () => {
    const categories = ['Zebras', 'Apples', 'Bananas'];
    const sorted = sortCategories(categories);
    expect(sorted).toEqual(['Apples', 'Bananas', 'Zebras']);
  });

  it('should prioritize smartphones', () => {
    const categories = ['Laptops', 'Smartphones', 'Cameras'];
    const sorted = sortCategories(categories);
    expect(sorted).toEqual(['Smartphones', 'Cameras', 'Laptops']); // Cameras before Laptops alphabetically
  });

  it('should prioritize "mobile" and "phone" related categories', () => {
    const categories = ['Tablets', 'Mobile Phones', 'Accessories'];
    const sorted = sortCategories(categories);
    expect(sorted[0]).toBe('Mobile Phones');
  });

  it('should use priority list', () => {
    const categories = ['Zebra', 'Apple', 'Banana'];
    const priorityList = ['banana', 'apple'];
    const sorted = sortCategories(categories, priorityList);
    // Banana (0), Apple (1), Zebra (no priority)
    expect(sorted).toEqual(['Banana', 'Apple', 'Zebra']);
  });

  it('should handle partial matches in priority list', () => {
    const categories = ['Apple Watch', 'Zebra'];
    const priorityList = ['apple'];
    const sorted = sortCategories(categories, priorityList);
    expect(sorted).toEqual(['Apple Watch', 'Zebra']);
  });

  it('should combine rules: Smartphone > Priority > Alphabetical', () => {
    const categories = [
      'Zebra',
      'Gaming Laptops',
      'Smartphones',
      'Accessories',
    ];
    const priorityList = ['gaming'];

    const sorted = sortCategories(categories, priorityList);
    // 1. Smartphones (Top)
    // 2. Gaming Laptops (Priority 'gaming')
    // 3. Accessories (Alpha)
    // 4. Zebra (Alpha)
    expect(sorted).toEqual([
      'Smartphones',
      'Gaming Laptops',
      'Accessories',
      'Zebra',
    ]);
  });

  it('should handle mixed casing correctly', () => {
    // localeCompare usually sorts 'a' < 'B' < 'c' or 'a' < 'b' < 'C' depending on locale
    // but definitely case insensitive for ordering words
    const categories = ['banana', 'Apple'];
    const sorted = sortCategories(categories);
    expect(sorted).toEqual(['Apple', 'banana']);
  });
});
