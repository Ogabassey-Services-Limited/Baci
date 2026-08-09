import { createHash } from 'node:crypto';
import { join, resolve as resolvePath } from 'node:path';
import { createRemediationCaseState } from './remediation-case-state.mjs';
import { redactCodexError } from './remediation-codex-output.mjs';
import { runRemediationAutofix } from './remediation-git-workflow.mjs';
import { reconcileRemediationLifecycle } from './remediation-lifecycle-recovery.mjs';
import { retryRemediationNotifications } from './remediation-notification-retry.mjs';
import {
  buildCodexRemediationPrompt,
  evaluateMergePolicy,
} from './remediation-policy.mjs';
import { createRemediationPrJournal } from './remediation-pr-journal.mjs';
import { writeRemediationPrompt } from './remediation-prompt-file.mjs';
import {
  buildRemediationReport,
  sendRemediationReportEmail,
} from './remediation-report.mjs';
import { createRemediationState } from './remediation-state.mjs';
import { recordRemediationOutcome } from './remediation-worker-candidate-state.mjs';
import {
  readPositiveInt,
  statePathForMode,
} from './remediation-worker-config.mjs';

function notificationIdFor(workerName, candidates) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        candidates: candidates.map((candidate) => [
          candidate.caseKey || candidate.fingerprint,
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
  if (!workerName) throw new Error('workerName is required');
  const outputDir = env.BACI_REMEDIATION_OUTPUT_DIR || `logs/${workerName}`;
  const mode =
    env.BACI_REMEDIATION_AUTOFIX_ENABLED === '1' ? 'autofix' : 'dry-run';
  const remediationStatePath = statePathForMode(
    env.BACI_REMEDIATION_STATE_PATH || join(outputDir, 'handled-state.json'),
    mode
  );
  const remediationCaseStatePath = statePathForMode(
    env.BACI_REMEDIATION_CASE_STATE_PATH || join(outputDir, 'case-state.json'),
    mode
  );
  const remediationPrJournalPath = statePathForMode(
    env.BACI_REMEDIATION_PR_JOURNAL_PATH || join(outputDir, 'pr-journal.json'),
    mode
  );
  if (
    resolvePath(remediationStatePath) ===
      resolvePath(remediationCaseStatePath) ||
    resolvePath(remediationStatePath) ===
      resolvePath(remediationPrJournalPath) ||
    resolvePath(remediationCaseStatePath) ===
      resolvePath(remediationPrJournalPath)
  ) {
    throw new Error(
      'remediation state, lifecycle, and journal paths must differ'
    );
  }
  const loadedCandidates = await candidateLoader({ env, fetchFn });
  const state = createRemediationState({
    now,
    path: remediationStatePath,
    retryDelayMs: readPositiveInt(
      env.BACI_REMEDIATION_RETRY_DELAY_MS,
      6 * 60 * 60 * 1_000
    ),
  });
  const caseState = createRemediationCaseState({
    now,
    path: remediationCaseStatePath,
  });
  const prJournal = createRemediationPrJournal({
    now,
    path: remediationPrJournalPath,
  });
  const retriedNotifications = await retryRemediationNotifications({
    env,
    fetchFn,
    logger,
    state,
    workerName,
  });
  const actions = retriedNotifications.actions;
  let email = retriedNotifications.email;
  const maximumCandidates = Math.min(
    readPositiveInt(env.BACI_REMEDIATION_MAX_CANDIDATES_PER_RUN, 1),
    10
  );
  const reconciledCandidates = reconcileRemediationLifecycle({
    candidates: loadedCandidates,
    caseState,
    journal: prJournal,
    state,
  });
  const lifecycleCandidates = reconciledCandidates.filter(
    (candidate) => !candidate.autofixEligible
  );
  const autofixCandidates = reconciledCandidates.filter(
    (candidate) => candidate.autofixEligible
  );
  state.pending(reconciledCandidates, { limit: 0 });
  let candidates = state.pending(caseState.orderCandidates(autofixCandidates), {
    limit: maximumCandidates,
  });
  if (candidates.length > 0) {
    const selections = caseState.recordSelections(candidates);
    if (!selections) throw new Error('remediation case state is busy');
    candidates = selections;
  }
  for (const candidate of lifecycleCandidates) {
    actions.push({ type: candidate.lifecycleEvent || 'lifecycle_observed' });
  }
  for (const pendingCandidate of candidates) {
    let candidate = pendingCandidate;
    if (typeof candidateEnricher === 'function') {
      try {
        const enrichedCandidate = await candidateEnricher({
          candidate: pendingCandidate,
          env,
          fetchFn,
        });
        candidate =
          enrichedCandidate && typeof enrichedCandidate === 'object'
            ? enrichedCandidate
            : pendingCandidate;
      } catch (error) {
        const safeError = redactCodexError(error);
        const detail = safeError.message;
        actions.push({
          detail,
          fingerprint: pendingCandidate.fingerprint,
          type: 'candidate_enrichment_failed',
        });
        candidates = recordRemediationOutcome({
          candidate: pendingCandidate,
          candidates,
          caseState,
          outcome: {
            detail,
            type: 'candidate_enrichment_failed',
          },
          pendingCandidate,
        });
        if (!state.complete({ deferCandidates: [pendingCandidate] })) {
          throw new Error('remediation state is busy');
        }
        logger.error(`[${workerName}] candidate enrichment failed:`, safeError);
        continue;
      }
    }
    const prompt = buildCodexRemediationPrompt({ candidate });
    const path = writeRemediationPrompt({ candidate, outputDir });
    actions.push({ path, type: 'prompt_written' });
    logger.log(`[${workerName}] wrote ${path}`);
    if (mode !== 'autofix') {
      candidates = recordRemediationOutcome({
        candidate,
        candidates,
        caseState,
        outcome: { type: 'prompt_written' },
        pendingCandidate,
      });
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
      candidates = recordRemediationOutcome({
        candidate,
        candidates,
        caseState,
        outcome: {
          detail: error instanceof Error ? error.message : String(error),
          type: 'autofix_failed',
        },
        pendingCandidate,
      });
      if (!state.complete({ deferCandidates: [candidate] })) {
        throw new Error('remediation state is busy');
      }
      logger.error(`[${workerName}] autofix failed:`, error);
      continue;
    }
    actions.push(result);
    if (result.type === 'pr_opened') {
      prJournal.record({ candidate, result });
      state.recordHandledFallback([candidate]);
    }
    candidates = recordRemediationOutcome({
      candidate,
      candidates,
      caseState,
      outcome: result,
      pendingCandidate,
    });
    const handled = ['no_changes', 'policy_blocked', 'pr_opened'].includes(
      result.type
    );
    const completed = state.complete(
      handled
        ? { handledCandidates: [candidate] }
        : { deferCandidates: [candidate] }
    );
    if (!completed) {
      throw new Error('remediation state is busy');
    }
    if (result.type === 'pr_opened') prJournal.clear(candidate.caseKey);
  }
  const policy = evaluateMergePolicy({
    changedFiles: [],
    checksPassed: false,
    hasHighSeverityReview: false,
    hasUnresolvedThreads: false,
  });
  const reportCandidates = [...candidates, ...lifecycleCandidates];
  let report = buildRemediationReport({
    actions,
    candidates: reportCandidates,
    mode,
    policy,
    source: workerName,
  });
  if (reportCandidates.length === 0) {
    return {
      actions,
      candidates: reportCandidates,
      email,
      mode,
      policy,
      report,
    };
  }
  const notificationId = notificationIdFor(workerName, reportCandidates);
  if (!state.complete({ notification: { id: notificationId, report } })) {
    throw new Error('remediation state is busy');
  }
  try {
    email = await sendRemediationReportEmail({ env, fetchFn, report });
    if (email.skipped) {
      actions.push({ detail: notificationId, type: 'email_skipped' });
      report = buildRemediationReport({
        actions,
        candidates: reportCandidates,
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
      candidates: reportCandidates,
      mode,
      policy,
      source: workerName,
    });
    if (!state.complete({ notification: { id: notificationId, report } })) {
      throw new Error('remediation state is busy');
    }
    email = { error: detail, skipped: true };
  }
  return { actions, candidates: reportCandidates, email, mode, policy, report };
}
