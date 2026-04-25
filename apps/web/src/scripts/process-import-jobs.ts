import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

type ServiceModule = typeof import('../lib/supabase/service') & {
  default?: typeof import('../lib/supabase/service');
};
type ImportJobModule = typeof import('../lib/import-jobs/process-import-job') & {
  default?: typeof import('../lib/import-jobs/process-import-job');
};

function readImportJobBatchSize() {
  const parsed = Number.parseInt(
    process.env.IMPORT_JOB_WORKER_BATCH_SIZE || '',
    10
  );
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 3;
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

export async function runProcessImportJobsCli(): Promise<number> {
  const serviceModule = (await import('../lib/supabase/service')) as ServiceModule;
  const importJobModule = (await import(
    '../lib/import-jobs/process-import-job'
  )) as ImportJobModule;
  const createServiceClient =
    serviceModule.createServiceClient ??
    serviceModule.default?.createServiceClient;
  const processImportJobQueue =
    importJobModule.processImportJobQueue ??
    importJobModule.default?.processImportJobQueue;

  if (!createServiceClient || !processImportJobQueue) {
    throw new Error('Failed to load import job worker dependencies');
  }

  const results = await processImportJobQueue(
    createServiceClient(),
    readImportJobBatchSize()
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
