import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { getImportJobWorkerBatchSize } from '@/env';
import {
  processImportJobById,
  processImportJobQueue,
} from '@/lib/import-jobs/process-import-job';
import { createServiceClient } from '@/lib/supabase/service';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ProcessImportJobsCliOptions {
  env?: Record<string, string | undefined>;
}

function summarizeResults(results: Record<string, unknown>[]) {
  const statusCounts = results.reduce<Record<string, number>>(
    (counts, result) => {
      const status =
        typeof result.status === 'string' ? result.status : 'unknown';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    },
    {}
  );

  return {
    processed: results.length,
    statusCounts,
  };
}

function getTriggeredJobId(env: Record<string, string | undefined>) {
  const rawJobId = env.IMPORT_JOB_TRIGGER_JOB_ID?.trim();
  if (!rawJobId) {
    return null;
  }

  if (!UUID_PATTERN.test(rawJobId)) {
    throw new Error('IMPORT_JOB_TRIGGER_JOB_ID must be a UUID');
  }

  return rawJobId;
}

export async function runProcessImportJobsCli({
  env = process.env,
}: ProcessImportJobsCliOptions = {}): Promise<number> {
  const triggeredJobId = getTriggeredJobId(env);
  const supabase = createServiceClient();
  const results = triggeredJobId
    ? await processTriggeredImportJob(supabase, triggeredJobId)
    : await processImportJobQueue(supabase, getImportJobWorkerBatchSize());
  const summary = summarizeResults(results);

  console.log(
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        ...summary,
      },
      null,
      2
    )
  );

  return (triggeredJobId && results.length === 0) ||
    results.some((result) => result.status === 'failed')
    ? 1
    : 0;
}

async function processTriggeredImportJob(
  supabase: ReturnType<typeof createServiceClient>,
  jobId: string
) {
  const result = await processImportJobById(supabase, jobId);
  if (result) {
    return [result];
  }

  console.error(
    JSON.stringify({
      jobId,
      message: 'Triggered import job was not claimed',
    })
  );
  return [];
}

const currentFile = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (import.meta.url === currentFile) {
  runProcessImportJobsCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.stack || error.message : error);
      process.exitCode = 1;
    });
}
