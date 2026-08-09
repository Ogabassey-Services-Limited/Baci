import { createHash } from 'node:crypto';
import { evaluateMergePolicy } from './remediation-policy.mjs';
import {
  buildRemediationReport,
  sendRemediationReportEmail,
} from './remediation-report.mjs';

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

export async function finalizeRemediationWorkerReport({
  actions,
  candidates,
  email,
  env,
  fetchFn,
  logger,
  mode,
  state,
  workerName,
}) {
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
    if (!state.complete({ notification: { id: notificationId, report } })) {
      throw new Error('remediation state is busy');
    }
    email = { error: detail, skipped: true };
  }
  return { actions, candidates, email, mode, policy, report };
}
