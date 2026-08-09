import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';
import { fetchPostHogRemediationCandidates } from '../lib/posthog-error-events.mjs';
import { runRemediationWorker } from '../lib/remediation-worker.mjs';

export function runPostHogErrorRemediator({
  autofixRunner,
  env = process.env,
  fetchFn = fetch,
  logger = console,
} = {}) {
  const outputDir =
    env.BACI_POSTHOG_REMEDIATION_OUTPUT_DIR || 'logs/posthog-error-remediator';
  const remediatorEnvironment = {
    ...env,
    BACI_REMEDIATION_OUTPUT_DIR: outputDir,
    BACI_REMEDIATION_STATE_PATH:
      env.BACI_POSTHOG_REMEDIATION_STATE_PATH ||
      `${outputDir}/handled-state.json`,
  };
  const candidateLoader =
    env.BACI_POSTHOG_REMEDIATION_ENABLED === '1'
      ? fetchPostHogRemediationCandidates
      : async () => [];

  return runRemediationWorker({
    autofixRunner,
    candidateLoader,
    env: remediatorEnvironment,
    fetchFn,
    logger,
    workerName: 'posthog-error-remediator',
  });
}

async function main() {
  config({ path: new URL('../.env', import.meta.url) });
  try {
    const result = await runPostHogErrorRemediator();
    console.log(
      JSON.stringify(
        {
          actions: result.actions,
          candidates: result.candidates.length,
          email: result.email,
          mode: result.mode,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('[posthog-error-remediator] Worker failed:', error);
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
