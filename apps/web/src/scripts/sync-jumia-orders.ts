import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

type ServiceModule = typeof import('../lib/supabase/service') & {
  default?: typeof import('../lib/supabase/service');
};
type SyncModule = typeof import('../lib/jumia/order-sync') & {
  default?: typeof import('../lib/jumia/order-sync');
};

export async function runJumiaOrderSyncCli(): Promise<number> {
  const serviceModule = (await import('../lib/supabase/service')) as ServiceModule;
  const syncModule = (await import('../lib/jumia/order-sync')) as SyncModule;
  const createServiceClient =
    serviceModule.createServiceClient ??
    serviceModule.default?.createServiceClient;
  const syncJumiaOrdersForActiveIntegrations =
    syncModule.syncJumiaOrdersForActiveIntegrations ??
    syncModule.default?.syncJumiaOrdersForActiveIntegrations;

  if (!createServiceClient) throw new Error('Missing dependency: createServiceClient');
  if (!syncJumiaOrdersForActiveIntegrations) {
    throw new Error('Missing dependency: syncJumiaOrdersForActiveIntegrations');
  }

  const result = await syncJumiaOrdersForActiveIntegrations(
    createServiceClient()
  );

  console.log(
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        ...result,
      },
      null,
      2
    )
  );

  return result.errors.length > 0 ? 1 : 0;
}

const currentFile = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (import.meta.url === currentFile) {
  runJumiaOrderSyncCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.stack || error.message : error);
      process.exitCode = 1;
    });
}
