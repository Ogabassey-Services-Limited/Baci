export function reconcileRemediationLifecycle({
  caseState,
  candidates,
  journal,
  state,
}) {
  if (!caseState.migrateLegacyHandled(state.handledCandidates(candidates))) {
    throw new Error('remediation case state is busy');
  }
  const recovered = caseState.reconcile(candidates);
  let replayedJournal = false;
  const replayedRecurrences = [];
  for (const entry of journal.entries()) {
    const candidate = recovered.find((item) => item.caseKey === entry.caseKey);
    if (!candidate) continue;
    const recorded = caseState.recordOutcome(candidate, entry);
    if (!recorded) {
      throw new Error('remediation case state is busy');
    }
    const lifecycleCandidate = recorded === true ? candidate : recorded;
    if (!state.complete({ handledCandidates: [lifecycleCandidate] })) {
      throw new Error('remediation state is busy');
    }
    journal.clear(entry.caseKey);
    replayedJournal = true;
    if (lifecycleCandidate.recurrenceCount > 0) {
      replayedRecurrences.push({
        ...lifecycleCandidate,
        autofixEligible: false,
        lifecycleEvent: 'active_draft_recurrence',
      });
    }
  }
  if (!replayedJournal) return recovered;
  return [
    ...new Map(
      [...caseState.reconcile(candidates), ...replayedRecurrences].map(
        (candidate) => [candidate.caseKey, candidate]
      )
    ).values(),
  ];
}
