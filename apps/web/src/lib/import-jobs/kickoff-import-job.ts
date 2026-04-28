import { isProduction } from '@/env';
import { processImportJobById } from '@/lib/import-jobs/process-import-job';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

// API routes persist the import job before calling this helper. In production,
// processing is owned by the VPS cron worker; non-production inline processing
// may throw and callers should keep wrapping this helper in background try/catch.
export async function startImportJob(
  jobId: string,
  origin: string
): Promise<void> {
  if (isProduction()) {
    logger.info({
      message: 'Import job persisted; VPS worker will process',
      jobId,
      origin,
    });
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
