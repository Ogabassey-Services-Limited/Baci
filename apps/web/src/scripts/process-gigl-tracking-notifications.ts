import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { runGiglTrackingNotificationBatch } from '@/app/api/cron/gigl-tracking-notifications/run-gigl-tracking-notification-batch';
import { createServiceClient } from '@/lib/supabase/service';

interface CliLogger {
  error(message: string): void;
  info(message: string, summary: string): void;
}

type RunBatch = (options: {
  batchSize: number;
}) => Promise<Awaited<ReturnType<typeof runGiglTrackingNotificationBatch>>>;

const REQUIRED_ENV = [
  'EXPO_ACCESS_TOKEN',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ZEPTOMAIL_TOKEN',
] as const;

function hasRequiredEnv(env: NodeJS.ProcessEnv) {
  return REQUIRED_ENV.every((name) => Boolean(env[name]?.trim()));
}

async function runBatchDirectly({ batchSize }: { batchSize: number }) {
  return runGiglTrackingNotificationBatch({
    batchSize,
    client: createServiceClient('event-pipeline'),
    workerId: `gigl-notifications-vps-${randomUUID()}`,
  });
}

export async function runGiglTrackingNotificationsCli({
  env = process.env,
  logger = console,
  runBatch = runBatchDirectly,
}: {
  env?: NodeJS.ProcessEnv;
  logger?: CliLogger;
  runBatch?: RunBatch;
} = {}): Promise<number> {
  if (!hasRequiredEnv(env)) {
    logger.error('[gigl-tracking-notifications] preflight failed');
    return 1;
  }

  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const emitError = logger.error.bind(logger);
  console.error = () =>
    emitError('[gigl-tracking-notifications] internal error');
  console.warn = () =>
    emitError('[gigl-tracking-notifications] internal warning');

  try {
    const result = await runBatch({ batchSize: 10 });
    if (!result.ok) {
      emitError('[gigl-tracking-notifications] failed');
      return 1;
    }

    const { claimed, failed, sent, skipped, success } = result.summary;
    logger.info(
      '[gigl-tracking-notifications] completed',
      JSON.stringify({ claimed, failed, sent, skipped, success })
    );
    return 0;
  } catch {
    emitError('[gigl-tracking-notifications] failed');
    return 1;
  } finally {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  runGiglTrackingNotificationsCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
