import { describe, expect, it, vi } from 'vitest';
import { createImportNotificationProgressReporter } from './send-import-notification-progress';

describe('createImportNotificationProgressReporter', () => {
  it('reports initial and processed recipient snapshots', async () => {
    const onProgress = vi.fn();
    const progress = createImportNotificationProgressReporter({
      importJobId: 'job-1',
      onProgress,
      totalRecipients: 3,
    });

    await progress.report();
    await progress.markProcessed('sent');
    await progress.markProcessed('skipped');
    await progress.markProcessed('failed');

    expect(onProgress).toHaveBeenNthCalledWith(1, {
      failedCount: 0,
      processedRecipients: 0,
      sentCount: 0,
      skippedCount: 0,
      totalRecipients: 3,
    });
    expect(progress.getSnapshot()).toEqual({
      failedCount: 1,
      processedRecipients: 3,
      sentCount: 1,
      skippedCount: 1,
      totalRecipients: 3,
    });
  });

  it('logs progress callback failures without throwing', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const progress = createImportNotificationProgressReporter({
      importJobId: 'job-2',
      onProgress: vi.fn().mockRejectedValue(new Error('progress failed')),
      totalRecipients: 1,
    });

    await expect(progress.markProcessed('sent')).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to report import notification progress',
      expect.objectContaining({ importJobId: 'job-2' })
    );

    consoleSpy.mockRestore();
  });
});
