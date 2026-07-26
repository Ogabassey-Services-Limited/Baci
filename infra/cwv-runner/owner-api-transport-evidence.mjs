// biome-ignore-all format: compact bounded page validation stays below the repository file limit
import { appendCollectionPage } from './owner-api-transport-pagination.mjs';
import {
  canonical,
  exact,
  fail,
  hash,
  object,
} from './owner-api-transport-primitives.mjs';

const active = new Set([
  'queued',
  'in_progress',
  'requested',
  'waiting',
  'pending',
]);
const terminal = new Set(['completed']);
const known = new Set([...active, ...terminal]);
const PAGE_SIZE = 100;
const MAX_RUN_PAGES = 10;
const titleFor = (state) => `CWV Runner Attestation ${state.admissionId}`;
const date = (value) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const actor = (value) =>
  object(value) && typeof value.login === 'string' && value.login.length > 0;

function runRow(state, row) {
  if (
    !object(row) ||
    !Number.isInteger(row.id) ||
    row.id < 1 ||
    typeof row.status !== 'string' ||
    !known.has(row.status) ||
    typeof row.event !== 'string' ||
    typeof row.display_title !== 'string' ||
    !date(row.created_at) ||
    !actor(row.actor)
  )
    fail('invalid run evidence');
  if (row.event !== 'workflow_dispatch') fail('invalid run evidence');
  const matches = row.display_title === titleFor(state);
  const dispatchWallClockMs = state.dispatchIntent?.createdWallClockMs ?? state.createdWallClockMs;
  if (matches && Date.parse(row.created_at) < Math.floor(dispatchWallClockMs / 1000) * 1000)
    fail('invalid run evidence');
  if (matches && (row.actor.login !== state.repository.name.split('/')[0] || row.workflow_id !== state.workflow.id || row.path !== state.workflow.path || row.head_branch !== 'main' || row.head_sha !== state.expectedSha || row.run_attempt !== (state.expectedAttempt ?? state.run?.attempt ?? 1) || row.url !== `https://api.github.com/repos/${state.repository.name}/actions/runs/${row.id}` || row.html_url !== `https://github.com/${state.repository.name}/actions/runs/${row.id}`)) fail('invalid run evidence');
  return {
    actor: row.actor.login,
    admissionId: state.admissionId,
    createdAt: row.created_at,
    event: row.event,
    id: row.id,
    status: row.status,
    title: row.display_title,
    matches,
  };
}

export function completeRunPages(pages) {
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > MAX_RUN_PAGES)
    fail('invalid run pages');
  const total = pages[0]?.total_count;
  if (
    !Number.isInteger(total) ||
    total < 0 ||
    total > MAX_RUN_PAGES * PAGE_SIZE
  )
    fail('invalid run pages');
  const needed = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages.length !== needed) fail('incomplete run pages');
  const runs = pages.flatMap((page, index) => {
    if (
      !exact(page, ['total_count', 'workflow_runs']) ||
      page.total_count !== total ||
      !Array.isArray(page.workflow_runs) ||
      page.workflow_runs.length !==
        (index + 1 === needed ? total - index * PAGE_SIZE : PAGE_SIZE)
    )
      fail('invalid run pages');
    return page.workflow_runs;
  });
  if (new Set(runs.map((row) => row?.id)).size !== runs.length)
    fail('invalid run pages');
  return { total_count: total, workflow_runs: runs };
}

export const appendRunPage = (state, response) => appendCollectionPage(state, 'list-attestation-runs', response, 'workflow_runs');

function rowsFor(state, body) {
  if (
    !exact(body, ['total_count', 'workflow_runs']) ||
    !Number.isInteger(body.total_count) ||
    body.total_count < 0 ||
    !Array.isArray(body.workflow_runs) ||
    body.workflow_runs.length !== body.total_count ||
    body.workflow_runs.length > MAX_RUN_PAGES * PAGE_SIZE
  )
    fail('invalid run evidence');
  return body.workflow_runs.map((row) => runRow(state, row));
}

export function preDispatchEvidence(state, body, proofs = []) {
  const rows = rowsFor(state, body);
  if (rows.some((row) => active.has(row.status))) fail('active workflow run');
  const matches = rows.filter((row) => row.matches);
  return Object.freeze({
    responseSha256: hash(canonical({ body, proofs })),
    runs: matches,
    zeroActiveExactRuns: true,
  });
}

export function postDispatchEvidence(state, body, proofs = []) {
  if (state.postDispatchEvidence) fail('replayed reconciliation');
  const rows = rowsFor(state, body);
  const previous = new Set(
    state.preDispatchEvidence?.runs?.map((row) => row.id)
  );
  const matching = rows.filter((row) => row.matches && !previous.has(row.id));
  if (!matching.length) {
    if (rows.some((row) => active.has(row.status))) fail('ambiguous dispatched run');
    return undefined;
  }
  if (
    matching.length !== 1 ||
    !active.has(matching[0].status) ||
    rows.filter((row) => active.has(row.status) && row.id !== matching[0].id)
      .length
  )
    fail('ambiguous dispatched run');
  const run = matching[0]; const source = body.workflow_runs.find((row) => row.id === run.id); const attempt = state.expectedAttempt ?? state.run?.attempt ?? 1;
  if ((state.run?.id !== undefined && state.run.id !== run.id) || (state.run?.actor !== undefined && state.run.actor !== run.actor) || (state.run?.admissionId !== undefined && state.run.admissionId !== state.admissionId) || (state.run?.displayTitle !== undefined && state.run.displayTitle !== run.title) || (state.run?.event !== undefined && state.run.event !== run.event) || source.run_attempt !== attempt)
    fail('ambiguous dispatched run');
  const bound = { actor: run.actor, admissionId: state.admissionId, attempt, displayTitle: run.title, event: run.event, htmlUrl: source.html_url, id: run.id, runUrl: source.url, status: run.status };
  return Object.freeze({
    responseSha256: hash(canonical({ body, proofs })),
    stateGeneration: state.generation,
    run: bound,
  });
}

export function dispatchReconciliationPatch(state, body, receivedMonotonicMs, proofs = []) {
  if (!['DISPATCH_INTENT', 'DISPATCH_INDETERMINATE'].includes(state.phase) || !Number.isInteger(receivedMonotonicMs) || receivedMonotonicMs < state.dispatchIntent.createdMonotonicMs) fail('invalid dispatch reconciliation');
  const rows = rowsFor(state, body); const raw = body.workflow_runs.filter((row) => row.display_title === titleFor(state)); const pollCount = (state.dispatchReconciliation?.pollCount ?? 0) + 1; const responseSha256 = hash(canonical({ body, proofs }));
  if (raw.length > 1) return { dispatchReconciliation: { pollCount, reason: 'multiple-same-admission', responseSha256 }, phase: 'MANUAL_RECONCILIATION', runPageCursor: undefined, runPages: undefined };
  if (!raw.length) {
    const terminal = receivedMonotonicMs >= state.dispatchIntent.reconcileDeadlineMonotonicMs;
    return { dispatchReconciliation: { pollCount, reason: terminal ? 'same-admission-not-found' : 'polling', responseSha256 }, phase: terminal ? 'MANUAL_RECONCILIATION' : 'DISPATCH_INDETERMINATE', runPageCursor: undefined, runPages: undefined };
  }
  const source = raw[0]; const row = rows.find((value) => value.id === source.id);
  if (!exact(source, ['actor', 'created_at', 'display_title', 'event', 'head_branch', 'head_sha', 'html_url', 'id', 'path', 'run_attempt', 'status', 'url', 'workflow_id']) || source.workflow_id !== state.workflow.id || source.path !== state.workflow.path || source.head_branch !== 'main' || source.head_sha !== state.expectedSha || source.run_attempt !== 1 || source.url !== `https://api.github.com/repos/${state.repository.name}/actions/runs/${source.id}` || source.html_url !== `https://github.com/${state.repository.name}/actions/runs/${source.id}` || !active.has(source.status)) fail('invalid dispatch reconciliation');
  if (rows.some((value) => active.has(value.status) && value.id !== source.id)) return { dispatchReconciliation: { pollCount, reason: 'additional-active-run', responseSha256 }, phase: 'MANUAL_RECONCILIATION' };
  const run = { actor: row.actor, admissionId: state.admissionId, attempt: 1, displayTitle: row.title, event: row.event, htmlUrl: source.html_url, id: source.id, queuedSinceMonotonicMs: state.dispatchIntent.createdMonotonicMs, runUrl: source.url, status: source.status };
  const reconciled = { ...run }; delete reconciled.queuedSinceMonotonicMs;
  return { dispatchEvidence: { id: row.id, responseSha256 }, dispatchReconciliation: { pollCount, reason: 'same-admission-bound', responseSha256 }, phase: 'QUEUED', postDispatchEvidence: { responseSha256, run: reconciled, stateGeneration: state.generation }, queueDeadlineMonotonicMs: state.dispatchIntent.createdMonotonicMs + 120000, queueTimerAttempt: 1, run };
}

export function dispatchRunEvidence(state, body) {
  if (
    !exact(body, ['html_url', 'run_url', 'workflow_run_id']) ||
    !Number.isInteger(body.workflow_run_id) ||
    body.workflow_run_id < 1 ||
    body.run_url !== `https://api.github.com/repos/${state.repository.name}/actions/runs/${body.workflow_run_id}` ||
    body.html_url !== `https://github.com/${state.repository.name}/actions/runs/${body.workflow_run_id}`
  )
    fail('invalid dispatch response');
  return Object.freeze({
    htmlUrl: body.html_url,
    id: body.workflow_run_id,
    responseSha256: hash(JSON.stringify(body)),
    runUrl: body.run_url,
  });
}

export function boundRunEvidence(state, body) {
  if (
    !exact(body, ['actor', 'conclusion', 'created_at', 'display_title', 'event', 'head_branch', 'head_sha', 'html_url', 'id', 'path', 'run_attempt', 'status', 'url', 'workflow_id']) ||
    body.id !== state.run?.id ||
    body.run_attempt !== state.run.attempt ||
    body.workflow_id !== state.workflow.id ||
    body.path !== state.workflow.path ||
    body.head_sha !== state.expectedSha ||
    body.head_branch !== 'main' ||
    typeof body.status !== 'string' ||
    !(body.conclusion === null || typeof body.conclusion === 'string')
  )
    fail('invalid run response');
  const row = runRow(state, body);
  if (!row.matches) fail('invalid run response');
  return { ...row, conclusion: body.conclusion };
}
