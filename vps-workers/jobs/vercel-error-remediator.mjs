/**
 * VPS worker: vercel-error-remediator
 * Converts Vercel log-drain JSONL into Codex remediation prompts and reports.
 */

import { createHash } from 'node:crypto';
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
import { createRemediationState } from '../lib/remediation-state.mjs';
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

function statePathForMode(path, mode) {
  return path.endsWith('.json')
    ? `${path.slice(0, -'.json'.length)}.${mode}.json`
    : `${path}.${mode}`;
}

function writePrompt({ candidate, outputDir }) {
  mkdirSync(outputDir, { recursive: true });
  const path = join(outputDir, `${candidate.fingerprint}.prompt.md`);
  writeFileSync(path, buildCodexRemediationPrompt({ candidate }));
  return path;
}

function notificationIdFor(workerName, candidates) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        candidates: candidates.map((candidate) => [
          candidate.fingerprint,
          candidate.lastSeen || candidate.occurrences,
        ]),
        workerName,
      })
    )
    .digest('hex')
    .slice(0, 20);
}

export async function runVercelErrorRemediator({
  autofixRunner = runRemediationAutofix,
  candidateLoader,
  env = process.env,
  fetchFn = fetch,
  logger = console,
  workerName = 'vercel-error-remediator',
} = {}) {
  let loadedCandidates;
  if (candidateLoader) {
    loadedCandidates = await candidateLoader({ env, fetchFn });
  } else {
    const logPath = env.VERCEL_ERROR_LOG_PATH;
    if (!logPath) {
      throw new Error('VERCEL_ERROR_LOG_PATH is required');
    }
    const rawEvents = readJsonlLogEvents(logPath);
    const groups = groupErrorEvents(rawEvents);
    loadedCandidates = selectRemediationCandidates(groups, {
      minOccurrences: readPositiveInt(env.BACI_REMEDIATION_MIN_OCCURRENCES, 2),
    });
  }
  const outputDir = getOutputDir(env);
  const mode =
    env.BACI_REMEDIATION_AUTOFIX_ENABLED === '1' ? 'autofix' : 'dry-run';
  const state = createRemediationState({
    path: statePathForMode(
      env.BACI_REMEDIATION_STATE_PATH || join(outputDir, 'handled-state.json'),
      mode
    ),
  });
  const actions = [];
  const handledCandidates = [];
  let email = { reason: 'no candidates', skipped: true };

  for (const notification of state.notifications()) {
    try {
      email = await sendRemediationReportEmail({
        env,
        fetchFn,
        report: notification.report,
      });
      state.acknowledgeNotification(notification.id);
      actions.push({ detail: notification.id, type: 'email_retried' });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logger.error(`[${workerName}] report email retry failed:`, error);
      actions.push({ detail, type: 'email_retry_failed' });
      email = { error: detail, skipped: true };
    }
  }

  const candidates = state.pending(loadedCandidates);

  for (const candidate of candidates) {
    const prompt = buildCodexRemediationPrompt({ candidate });
    const path = writePrompt({ candidate, outputDir });
    actions.push({ path, type: 'prompt_written' });
    logger.log(`[${workerName}] wrote ${path}`);

    if (mode === 'autofix') {
      try {
        const result = await autofixRunner({ candidate, env, prompt });
        actions.push(result);
        if (
          ['no_changes', 'policy_blocked', 'pr_opened'].includes(result.type)
        ) {
          handledCandidates.push(candidate);
          if (!state.complete({ handledCandidates: [candidate] })) {
            throw new Error('remediation state is busy');
          }
        } else if (!state.complete({ releaseCandidates: [candidate] })) {
          throw new Error('remediation state is busy');
        }
      } catch (error) {
        actions.push({
          detail: error instanceof Error ? error.message : String(error),
          fingerprint: candidate.fingerprint,
          type: 'autofix_failed',
        });
        if (!state.complete({ releaseCandidates: [candidate] })) {
          throw new Error('remediation state is busy');
        }
        logger.error(`[${workerName}] autofix failed:`, error);
      }
    } else {
      handledCandidates.push(candidate);
      if (!state.complete({ handledCandidates: [candidate] })) {
        throw new Error('remediation state is busy');
      }
    }
  }
  const policy = evaluateMergePolicy({
    changedFiles: [],
    checksPassed: false,
    hasHighSeverityReview: false,
    hasUnresolvedThreads: false,
  });
  let report = buildRemediationReport({
    actions,
    candidates,
    mode,
    policy,
    source: workerName,
  });
  if (candidates.length === 0) {
    return { actions, candidates, email, mode, policy, report };
  }

  const notificationId = notificationIdFor(workerName, candidates);
  const completed = state.complete({
    notification: { id: notificationId, report },
  });
  if (!completed) {
    throw new Error('remediation state is busy');
  }

  try {
    email = await sendRemediationReportEmail({ env, fetchFn, report });
    state.acknowledgeNotification(notificationId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error(`[${workerName}] report email failed:`, error);
    actions.push({ detail, type: 'email_failed' });
    report = buildRemediationReport({
      actions,
      candidates,
      mode,
      policy,
      source: workerName,
    });
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
