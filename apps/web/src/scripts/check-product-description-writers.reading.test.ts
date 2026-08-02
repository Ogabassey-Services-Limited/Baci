import { describe, expect, it } from 'vitest';
import { readFilesWithConcurrency } from './check-product-description-writers';

describe('readFilesWithConcurrency', () => {
  it('bounds simultaneous source reads instead of opening every file at once', async () => {
    let activeReads = 0;
    let peakReads = 0;
    const files = Array.from({ length: 64 }, (_, index) => `fixture-${index}`);

    const contents = await readFilesWithConcurrency(
      files,
      4,
      async (path) => {
        activeReads += 1;
        peakReads = Math.max(peakReads, activeReads);
        await Promise.resolve();
        activeReads -= 1;
        return path;
      }
    );

    expect(contents).toEqual(files);
    expect(peakReads).toBeLessThanOrEqual(4);
  });
});
