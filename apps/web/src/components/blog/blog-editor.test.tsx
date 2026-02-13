import { describe, expect, it, vi } from 'vitest';

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

import { BlogEditor } from './blog-editor';

describe('BlogEditor', () => {
  it('exports a valid component', () => {
    expect(BlogEditor).toBeDefined();
    expect(typeof BlogEditor).toBe('function');
  });
});
