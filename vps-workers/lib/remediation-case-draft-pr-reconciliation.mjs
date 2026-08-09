const MAX_DRAFT_PR_RECONCILIATIONS = 10;

export function reconcileStoredDraftPrs({
  candidates,
  maxOutcomes,
  normalizeCandidate,
  now,
  storage,
  resolveDraftPrStatus,
  limit,
}) {
  if (typeof resolveDraftPrStatus !== 'function') {
    throw new Error('resolveDraftPrStatus is required');
  }
  const requestedCaseKeys = new Set(
    candidates
      .map(normalizeCandidate)
      .filter(Boolean)
      .map((candidate) => candidate.caseKey)
  );
  const maximum = Math.min(
    Number.isSafeInteger(limit) && limit > 0
      ? limit
      : MAX_DRAFT_PR_RECONCILIATIONS,
    MAX_DRAFT_PR_RECONCILIATIONS
  );
  const drafts = Object.values(storage.read().cases)
    .filter(
      (item) => requestedCaseKeys.has(item.key) && Boolean(item.draftPr)
    )
    .sort((left, right) => right.lastSeen.localeCompare(left.lastSeen))
    .slice(0, maximum)
    .map((item) => ({
      caseKey: item.key,
      openedAt: item.draftPr.openedAt,
      url: item.draftPr.url,
    }));
  const reconciled = drafts.map((draft) => {
    try {
      const status = resolveDraftPrStatus(draft);
      if (!['open', 'closed', 'merged'].includes(status)) {
        throw new Error('GitHub pull request lookup returned an invalid state');
      }
      return { ...draft, status };
    } catch {
      return { ...draft, status: 'error' };
    }
  });
  const nowMs = now();
  return storage.withLock(nowMs, { failed: drafts.length, transitioned: 0 }, (state) => {
    let failed = 0;
    let transitioned = 0;
    for (const draft of reconciled) {
      const item = state.cases[draft.caseKey];
      if (
        !item?.draftPr ||
        item.draftPr.url !== draft.url ||
        item.draftPr.openedAt !== draft.openedAt
      ) {
        continue;
      }
      if (draft.status === 'error') {
        failed += 1;
        continue;
      }
      if (draft.status === 'open') continue;
      item.draftPr = null;
      item.status = 'open';
      item.outcomes = [
        ...item.outcomes,
        {
          at: new Date(nowMs).toISOString(),
          detail: `GitHub reported linked draft pull request ${draft.status}`,
          type: `draft_pr_${draft.status}`,
        },
      ].slice(-maxOutcomes);
      transitioned += 1;
    }
    if (transitioned > 0) storage.persist(state);
    return { failed, transitioned };
  });
}
