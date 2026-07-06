export interface ImportNotificationProgressSnapshot {
  failedCount: number;
  processedRecipients: number;
  sentCount: number;
  skippedCount: number;
  totalRecipients: number;
}

export type ImportNotificationProgressCallback = (
  progress: ImportNotificationProgressSnapshot
) => void | Promise<void>;

type ImportNotificationProgressOutcome = 'failed' | 'sent' | 'skipped';

export function createImportNotificationProgressReporter({
  importJobId,
  onProgress,
  totalRecipients,
}: {
  importJobId: string;
  onProgress?: ImportNotificationProgressCallback;
  totalRecipients: number;
}) {
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let processedRecipients = 0;

  const getSnapshot = (): ImportNotificationProgressSnapshot => ({
    failedCount,
    processedRecipients,
    sentCount,
    skippedCount,
    totalRecipients,
  });

  const report = async () => {
    try {
      await onProgress?.(getSnapshot());
    } catch (error) {
      console.error('Failed to report import notification progress', {
        error,
        importJobId,
      });
    }
  };

  return {
    getSnapshot,
    markProcessed: async (outcome: ImportNotificationProgressOutcome) => {
      if (outcome === 'failed') {
        failedCount += 1;
      } else if (outcome === 'sent') {
        sentCount += 1;
      } else {
        skippedCount += 1;
      }

      processedRecipients += 1;
      await report();
    },
    report,
  };
}
