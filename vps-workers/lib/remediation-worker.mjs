import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runRemediationAutofix } from './remediation-git-workflow.mjs';
import {
  buildCodexRemediationPrompt,
  evaluateMergePolicy,
} from './remediation-policy.mjs';
import {
  buildRemediationReport,
  sendRemediationReportEmail,
} from './remediation-report.mjs';
import { createRemediationState } from './remediation-state.mjs';

function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
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

export async function runRemediationWorker({
  autofixRunner = runRemediationAutofix,
  candidateEnricher,
  candidateLoader,
  env = process.env,
  fetchFn = fetch,
  logger = console,
  now = () => Date.now(),
  workerName,
} = {}) {
  if (typeof candidateLoader !== 'function') {
    throw new Error('candidateLoader is required');
  }
  if (!workerName) {
    throw new Error('workerName is required');
  }

  const loadedCandidates = await candidateLoader({ env, fetchFn });
  const outputDir = env.BACI_REMEDIATION_OUTPUT_DIR || `logs/${workerName}`;
  const mode =
    env.BACI_REMEDIATION_AUTOFIX_ENABLED === '1' ? 'autofix' : 'dry-run';
  const state = createRemediationState({
    now,
    path: statePathForMode(
      env.BACI_REMEDIATION_STATE_PATH || join(outputDir, 'handled-state.json'),
      mode
    ),
    retryDelayMs: readPositiveInt(
      env.BACI_REMEDIATION_RETRY_DELAY_MS,
      6 * 60 * 60 * 1_000
    ),
  });
  const actions = [];
  let email = { reason: 'no candidates', skipped: true };

  for (const notification of state.notifications()) {
    try {
      email = await sendRemediationReportEmail({
        env,
        fetchFn,
        report: notification.report,
      });
      if (email.skipped) {
        actions.push({ detail: notification.id, type: 'email_skipped' });
      } else {
        state.acknowledgeNotification(notification.id);
        actions.push({ detail: notification.id, type: 'email_retried' });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logger.error(`[${workerName}] report email retry failed:`, error);
      actions.push({ detail, type: 'email_retry_failed' });
      email = { error: detail, skipped: true };
    }
  }

  const maximumCandidates = Math.min(
    readPositiveInt(env.BACI_REMEDIATION_MAX_CANDIDATES_PER_RUN, 1),
    10
  );
  const candidates = state.pending(loadedCandidates, {
    limit:
      mode === 'autofix' || typeof candidateEnricher === 'function'
        ? maximumCandidates
        : Number.POSITIVE_INFINITY,
  });

  for (const pendingCandidate of candidates) {
    let candidate = pendingCandidate;
    if (typeof candidateEnricher === 'function') {
      try {
        candidate = await candidateEnricher({
          candidate: pendingCandidate,
          env,
          fetchFn,
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        actions.push({
          detail,
          fingerprint: pendingCandidate.fingerprint,
          type: 'candidate_enrichment_failed',
        });
        if (!state.complete({ deferCandidates: [pendingCandidate] })) {
          throw new Error('remediation state is busy');
        }
        logger.error(`[${workerName}] candidate enrichment failed:`, error);
        continue;
      }
    }
    const prompt = buildCodexRemediationPrompt({ candidate });
    const path = writePrompt({ candidate, outputDir });
    actions.push({ path, type: 'prompt_written' });
    logger.log(`[${workerName}] wrote ${path}`);

    if (mode !== 'autofix') {
      if (!state.complete({ handledCandidates: [candidate] })) {
        throw new Error('remediation state is busy');
      }
      continue;
    }

    let result;
    try {
      result = await autofixRunner({ candidate, env, prompt });
    } catch (error) {
      actions.push({
        detail: error instanceof Error ? error.message : String(error),
        fingerprint: candidate.fingerprint,
        type: 'autofix_failed',
      });
      if (!state.complete({ deferCandidates: [candidate] })) {
        throw new Error('remediation state is busy');
      }
      logger.error(`[${workerName}] autofix failed:`, error);
      continue;
    }

    actions.push(result);
    const handled = ['no_changes', 'policy_blocked', 'pr_opened'].includes(
      result.type
    );
    const completed = state.complete(
      handled
        ? { handledCandidates: [candidate] }
        : { deferCandidates: [candidate] }
    );
    if (!completed) {
      if (result.type === 'pr_opened') {
        state.recordHandledFallback([candidate]);
      }
      throw new Error('remediation state is busy');
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
  if (!state.complete({ notification: { id: notificationId, report } })) {
    throw new Error('remediation state is busy');
  }

  try {
    email = await sendRemediationReportEmail({ env, fetchFn, report });
    if (email.skipped) {
      actions.push({ detail: notificationId, type: 'email_skipped' });
      report = buildRemediationReport({
        actions,
        candidates,
        mode,
        policy,
        source: workerName,
      });
      if (!state.complete({ notification: { id: notificationId, report } })) {
        throw new Error('remediation state is busy');
      }
    } else {
      state.acknowledgeNotification(notificationId);
    }
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
