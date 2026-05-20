/**
 * VPS worker: vercel-error-remediator
 * Converts Vercel log-drain JSONL into Codex remediation prompts and reports.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';
import { runRemediationAutofix } from '../lib/remediation-git-workflow.mjs';
import {
  buildCodexRemediationPrompt,
  evaluateMergePolicy,
} from '../lib/remediation-policy.mjs';
import {
  buildRemediationReport,
  sendRemediationReportEmail,
} from '../lib/remediation-report.mjs';
import {
  groupErrorEvents,
  readJsonlLogEvents,
  selectRemediationCandidates,
} from '../lib/vercel-error-events.mjs';

function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getOutputDir(env) {
  return env.BACI_REMEDIATION_OUTPUT_DIR || 'logs/vercel-error-remediator';
}

function writePrompt({ candidate, outputDir }) {
  mkdirSync(outputDir, { recursive: true });
  const path = join(outputDir, `${candidate.fingerprint}.prompt.md`);
  writeFileSync(path, buildCodexRemediationPrompt({ candidate }));
  return path;
}

export async function runVercelErrorRemediator({
  autofixRunner = runRemediationAutofix,
  env = process.env,
  fetchFn = fetch,
  logger = console,
} = {}) {
  const logPath = env.VERCEL_ERROR_LOG_PATH;
  if (!logPath) {
    throw new Error('VERCEL_ERROR_LOG_PATH is required');
  }

  const rawEvents = readJsonlLogEvents(logPath);
  const groups = groupErrorEvents(rawEvents);
  const candidates = selectRemediationCandidates(groups, {
    minOccurrences: readPositiveInt(env.BACI_REMEDIATION_MIN_OCCURRENCES, 2),
  });
  const outputDir = getOutputDir(env);
  const mode =
    env.BACI_REMEDIATION_AUTOFIX_ENABLED === '1' ? 'autofix' : 'dry-run';
  const actions = [];

  for (const candidate of candidates) {
    const prompt = buildCodexRemediationPrompt({ candidate });
    const path = writePrompt({ candidate, outputDir });
    actions.push({ path, type: 'prompt_written' });
    logger.log(`[vercel-error-remediator] wrote ${path}`);

    if (mode === 'autofix') {
      try {
        const result = await autofixRunner({ candidate, env, prompt });
        actions.push(result);
      } catch (error) {
        logger.error('[vercel-error-remediator] autofix failed:', error);
        actions.push({
          detail: error instanceof Error ? error.message : String(error),
          fingerprint: candidate.fingerprint,
          type: 'autofix_failed',
        });
      }
    }
  }

  const policy = evaluateMergePolicy({
    changedFiles: [],
    checksPassed: false,
    hasHighSeverityReview: false,
    hasUnresolvedThreads: false,
  });
  let report = buildRemediationReport({ actions, candidates, mode, policy });
  let email = { reason: 'no candidates', skipped: true };
  if (candidates.length === 0) {
    return { actions, candidates, email, mode, policy, report };
  }

  try {
    email = await sendRemediationReportEmail({ env, fetchFn, report });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error('[vercel-error-remediator] report email failed:', error);
    actions.push({ detail, type: 'email_failed' });
    report = buildRemediationReport({ actions, candidates, mode, policy });
    email = { error: detail, skipped: true };
  }

  return { actions, candidates, email, mode, policy, report };
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
