import { triggerImportWorker } from '@/lib/import-jobs/import-job-service';
import { processImportJobById } from '@/lib/import-jobs/process-import-job';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

export async function kickoffImportJob(jobId: string, origin: string) {
  try {
    const result = await processImportJobById(createServiceClient(), jobId);
    if (result) {
      return;
    }
  } catch (error) {
    logger.error({
      message: 'Failed to start import job directly',
      error,
      jobId,
      origin,
    });
  }

  try {
    await triggerImportWorker(origin, jobId);
  } catch (error) {
    logger.error({
      message: 'Failed to trigger import worker fallback',
      error,
      jobId,
      origin,
    });
  }
}
