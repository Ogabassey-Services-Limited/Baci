import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import { triggerImportWorker } from './import-job-service';
import { processImportJobById } from './process-import-job';

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
