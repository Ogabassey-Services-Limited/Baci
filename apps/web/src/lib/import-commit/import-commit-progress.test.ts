import { describe, expect, it, vi } from 'vitest';
import { createCommitProgress } from './import-commit-progress';

describe('createCommitProgress', () => {
  it('reports incrementing commit progress with the configured total', async () => {
    const onProgress = vi.fn();
    const progress = createCommitProgress(2, onProgress);

    await progress.reportNext();
    await progress.reportNext();

    expect(onProgress).toHaveBeenNthCalledWith(1, {
      processedRecords: 1,
      totalRecords: 2,
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      processedRecords: 2,
      totalRecords: 2,
    });
  });

  it('allows callers to omit the progress callback', async () => {
    await expect(createCommitProgress(1).reportNext()).resolves.toBeUndefined();
  });
});
