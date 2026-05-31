import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { getImportJobWorkerBatchSize } from '@/env';
import { processImportJobQueue } from '@/lib/import-jobs/process-import-job';
import { createServiceClient } from '@/lib/supabase/service';

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

export async function runProcessImportJobsCli(): Promise<number> {
  const results = await processImportJobQueue(
    createServiceClient(),
    getImportJobWorkerBatchSize()
  );
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

  return results.some((result) => result.status === 'failed') ? 1 : 0;
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
