import 'dotenv/config';

import { pathToFileURL } from 'node:url';
import { reconcileProcessingVtuTransactions } from '@/lib/vtu-processing-reconciliation';
import { createServiceClient } from '@/lib/supabase/service';

export async function runReconcileVtuProcessingCli(): Promise<number> {
  const summary = await reconcileProcessingVtuTransactions({
    supabase: createServiceClient(),
  });

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

  return summary.errored > 0 ? 1 : 0;
}

const currentFile = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (import.meta.url === currentFile) {
  runReconcileVtuProcessingCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.stack || error.message : error);
      process.exitCode = 1;
    });
}
