import type { SupabaseClient } from '@supabase/supabase-js';
import type { ImportJobRecord } from '@/lib/import-jobs/import-job-service';

interface PreviewProgressLogger {
  error: (payload: {
    message: string;
    jobId: string;
    error: unknown;
    processedRows: number;
    totalRows: number;
  }) => void;
}

export function createPreviewProgressReporter(
  supabase: SupabaseClient,
  job: ImportJobRecord,
  logger: PreviewProgressLogger
) {
  const progressMinUpdateMs = 500;
  let adaptiveStep = 25;
  let adaptiveStepComputed = false;
  let lastProcessedRows = -1;
  let lastTotalRows = -1;
  let lastPersistedProcessedRows = -1;
  let lastProgressUpdateAt = 0;

  return async ({
    processedRows,
    totalRows,
  }: {
    processedRows: number;
    totalRows: number;
  }) => {
    if (processedRows === lastProcessedRows && totalRows === lastTotalRows) {
      return;
    }

    lastProcessedRows = processedRows;
    lastTotalRows = totalRows;

    if (!adaptiveStepComputed && totalRows > 0) {
      adaptiveStep = Math.max(10, Math.floor(totalRows / 20));
      adaptiveStepComputed = true;
    }

    const now = Date.now();
    const isFinalUpdate = processedRows >= totalRows;
    const isEarlyProgress = processedRows <= 5;
    const advancedEnough =
      processedRows - lastPersistedProcessedRows >= adaptiveStep;
    const timeWindowElapsed = now - lastProgressUpdateAt >= progressMinUpdateMs;

    if (
      !isFinalUpdate &&
      !isEarlyProgress &&
      !advancedEnough &&
      !timeWindowElapsed
    ) {
      return;
    }

    const { error: progressError } = await supabase
      .from('import_jobs')
      .update({
        processed_rows: processedRows,
        total_rows: totalRows,
      })
      .eq('id', job.id);

    if (progressError) {
      logger.error({
        message: 'Failed to update import preview progress',
        jobId: job.id,
        error: progressError,
        processedRows,
        totalRows,
      });
      return;
    }

    lastPersistedProcessedRows = processedRows;
    lastProgressUpdateAt = now;
  };
}
