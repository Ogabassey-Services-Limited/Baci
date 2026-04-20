import { describe, expect, it } from 'vitest';
import { BlogList } from './blog-list';

describe('BlogList', () => {
  it('exports a valid component', () => {
    expect(BlogList).toBeDefined();
    expect(typeof BlogList).toBe('function');
  });
});
