import 'dotenv/config';

import { pathToFileURL } from 'node:url';
import { createGiglTrackingWorkerClient } from '@/lib/gigl-tracking-worker-client';
import { verifyGiglTrackingWorkerCapability } from '@/lib/verify-gigl-tracking-worker-capability';

interface CapabilityLogger {
  error(message: string): void;
  info(message: string): void;
}

function isExplicitlyDisabled(value: string | undefined) {
  return ['0', 'false', 'off'].includes(value?.trim().toLowerCase() ?? '');
}

/** Runs the credentialed, non-mutating GIGL capability smoke. */
export async function runGiglTrackingCapabilityVerification({
  env = process.env,
  logger = console,
}: {
  env?: NodeJS.ProcessEnv;
  logger?: CapabilityLogger;
} = {}): Promise<number> {
  if (isExplicitlyDisabled(env.GIGL_ENABLED)) {
    logger.info('[gigl-capability] skipped while GIGL is disabled');
    return 0;
  }

  try {
    const client = createGiglTrackingWorkerClient(env);
    if (await verifyGiglTrackingWorkerCapability(client)) {
      logger.info('[gigl-capability] restricted wrapper verified');
      return 0;
    }
  } catch {
    // Keep credential and provider errors out of release logs.
  }

  logger.error('[gigl-capability] verification failed');
  return 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  runGiglTrackingCapabilityVerification().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
