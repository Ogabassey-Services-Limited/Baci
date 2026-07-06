import type { SupabaseClient } from '@supabase/supabase-js';
import type { ImportJobRecord } from '@/lib/import-jobs/import-job-service';

interface ImportJobProgressLogger {
  error: (payload: {
    message: string;
    jobId: string;
    error: unknown;
    summary: Record<string, unknown>;
  }) => void;
}

interface ImportJobSummaryProgressReporterInput {
  job: ImportJobRecord;
  logger: ImportJobProgressLogger;
  minUpdateMs?: number;
  processedKey: string;
  supabase: SupabaseClient;
  totalKey: string;
}

interface ImportJobSummaryProgressUpdate {
  processed: number;
  total: number;
  extra?: Record<string, number>;
}

function normalizeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function createImportJobSummaryProgressReporter({
  job,
  logger,
  minUpdateMs = 500,
  processedKey,
  supabase,
  totalKey,
}: ImportJobSummaryProgressReporterInput) {
  let summary = { ...(job.summary || {}) };
  let adaptiveStep = 1;
  let adaptiveStepComputed = false;
  let lastPersistedProcessed = -1;
  let lastPersistedTotal = -1;
  let lastProgressUpdateAt = 0;

  const report = async ({
    extra,
    processed,
    total,
  }: ImportJobSummaryProgressUpdate) => {
    const safeTotal = normalizeCount(total);
    const safeProcessed = Math.min(normalizeCount(processed), safeTotal || 0);

    if (!adaptiveStepComputed && safeTotal > 0) {
      adaptiveStep = Math.max(1, Math.floor(safeTotal / 20));
      adaptiveStepComputed = true;
    }

    const now = Date.now();
    const isFinalUpdate = safeTotal > 0 && safeProcessed >= safeTotal;
    const isFirstUpdate = lastPersistedProcessed < 0;
    const advancedEnough =
      safeProcessed - lastPersistedProcessed >= adaptiveStep;
    const totalChanged = safeTotal !== lastPersistedTotal;
    const timeWindowElapsed = now - lastProgressUpdateAt >= minUpdateMs;

    if (
      !isFinalUpdate &&
      !isFirstUpdate &&
      !totalChanged &&
      !advancedEnough &&
      !timeWindowElapsed
    ) {
      return;
    }

    const nextSummary = {
      ...summary,
      [processedKey]: safeProcessed,
      [totalKey]: safeTotal,
      ...(extra || {}),
    };
    let error: unknown = null;
    try {
      const result = await supabase
        .from('import_jobs')
        .update({ summary: nextSummary })
        .eq('id', job.id);
      error = result.error;
    } catch (caughtError) {
      error = caughtError;
    }

    if (error) {
      logger.error({
        message: 'Failed to update import job progress summary',
        jobId: job.id,
        error,
        summary: nextSummary,
      });
      return;
    }

    summary = nextSummary;
    lastPersistedProcessed = safeProcessed;
    lastPersistedTotal = safeTotal;
    lastProgressUpdateAt = now;
  };

  return {
    getSummary: () => summary,
    report,
  };
}
