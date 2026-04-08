import { getImportJobWorkerSecret, isProduction } from '@/env';
import { triggerImportWorker } from '@/lib/import-jobs/import-job-service';
import { processImportJobById } from '@/lib/import-jobs/process-import-job';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

export async function startImportJob(
  jobId: string,
  origin: string
): Promise<void> {
  const workerSecret = getImportJobWorkerSecret();

  if (isProduction() && workerSecret) {
    await triggerImportWorker(origin, jobId);
    return;
  }

  if (isProduction()) {
    const error = new Error('IMPORT_JOB_WORKER_SECRET is not configured');
    logger.error({
      message:
        'Import worker secret is required in production when worker delegation is enabled',
      jobId,
      origin,
      error,
    });
    throw error;
  }

  logger.warn({
    message:
      'IMPORT_JOB_WORKER_SECRET is not set in non-production; processing import job inline',
    jobId,
    origin,
  });

  const result = await processImportJobById(createAdminClient(), jobId);
  if (result) {
    return;
  }

  logger.warn({
    message: 'Non-production inline import processing did not claim the job',
    jobId,
    origin,
  });
}

export async function kickoffImportJob(
  jobId: string,
  origin: string
): Promise<void> {
  let firstError: unknown;
  try {
    const result = await processImportJobById(createAdminClient(), jobId);
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
    logger.info({
      message: 'Import worker fallback triggered successfully',
      jobId,
      origin,
    });
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
