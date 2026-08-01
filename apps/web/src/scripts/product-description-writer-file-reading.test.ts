import { describe, expect, it } from 'vitest';
import { readFilesWithConcurrency } from './product-description-writer-file-reading';

describe('product description writer file reading', () => {
  it('preserves input order while bounding reads', async () => {
    const files = ['one', 'two', 'three'];
    await expect(
      readFilesWithConcurrency(files, 2, async (file) => file.toUpperCase())
    ).resolves.toEqual(['ONE', 'TWO', 'THREE']);
  });
});
