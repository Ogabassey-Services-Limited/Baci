import { isProduction } from '@/env';
import { processImportJobById } from '@/lib/import-jobs/process-import-job';
import { triggerImportJobWorker } from '@/lib/import-jobs/trigger-import-job-worker';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

// API routes persist the import job before calling this helper. In production,
// processing is signaled to the VPS worker trigger, with the VPS cron sweep as
// fallback. Non-production inline processing may throw and callers should keep
// wrapping this helper in background try/catch.
export async function startImportJob(
  jobId: string,
  origin: string
): Promise<void> {
  if (isProduction()) {
    try {
      const result = await triggerImportJobWorker({ jobId, source: 'api' });
      if (!result.triggered) {
        logger.warn({
          message:
            'Import job persisted; VPS trigger is not configured, cron fallback will process',
          jobId,
          origin,
          reason: result.reason,
        });
        return;
      }

      logger.info({
        message: 'Import job VPS trigger accepted',
        jobId,
        origin,
        status: result.status,
      });
    } catch (error) {
      logger.error({
        message: 'Import job VPS trigger failed; cron fallback will process',
        error,
        jobId,
        origin,
      });
    }
    return;
  }

  logger.info({
    message: 'Processing import job inline in non-production',
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

// Preserved as a backward-compatible alias for older import-job call sites and
// tests; startImportJob remains the single implementation point.
export async function kickoffImportJob(
  jobId: string,
  origin: string
): Promise<void> {
  await startImportJob(jobId, origin);
}
