import { triggerImportWorker } from '@/lib/import-jobs/import-job-service';
import { processImportJobById } from '@/lib/import-jobs/process-import-job';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

export async function kickoffImportJob(
  jobId: string,
  origin: string
): Promise<void> {
  let firstError: unknown;
  try {
    const result = await processImportJobById(createServiceClient(), jobId);
    if (result) {
      return;
    }
    logger.warn({
      message: 'processImportJobById returned falsy, falling back to worker',
      jobId,
      origin,
    });
  } catch (error) {
    firstError = error;
    logger.error({
      message: 'Failed to start import job directly',
      error,
      jobId,
      origin,
    });
  }

  try {
    await triggerImportWorker(origin, jobId);
  } catch (secondError) {
    logger.error({
      message: 'Failed to trigger import worker fallback',
      error: secondError,
      jobId,
      origin,
    });
    throw new Error(
      `Import job ${jobId} failed: direct processing error: ${firstError instanceof Error ? firstError.message : String(firstError ?? 'returned falsy')}, worker fallback error: ${secondError instanceof Error ? secondError.message : String(secondError)}`
    );
  }
}
