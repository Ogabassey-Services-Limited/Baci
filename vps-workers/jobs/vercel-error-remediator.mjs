/**
 * VPS worker: vercel-error-remediator
 * Converts Vercel log-drain JSONL into Codex remediation prompts and reports.
 */

import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';
import { runRemediationWorker } from '../lib/remediation-worker.mjs';
import {
  groupErrorEvents,
  readJsonlLogEvents,
  selectRemediationCandidates,
} from '../lib/vercel-error-events.mjs';

function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function runVercelErrorRemediator({
  candidateLoader,
  ...options
} = {}) {
  const loadVercelCandidates =
    candidateLoader ||
    (({ env }) => {
      const logPath = env.VERCEL_ERROR_LOG_PATH;
      if (!logPath) {
        throw new Error('VERCEL_ERROR_LOG_PATH is required');
      }
      const rawEvents = readJsonlLogEvents(logPath);
      const groups = groupErrorEvents(rawEvents);
      return selectRemediationCandidates(groups, {
        minOccurrences: readPositiveInt(
          env.BACI_REMEDIATION_MIN_OCCURRENCES,
          2
        ),
      });
    });

  const result = await runRemediationWorker({
    ...options,
    candidateLoader: loadVercelCandidates,
    workerName: 'vercel-error-remediator',
  });
  return result;
}

async function main() {
  config({ path: new URL('../.env', import.meta.url) });

  try {
    const result = await runVercelErrorRemediator();
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
    console.error('[vercel-error-remediator] Worker failed:', error);
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
