// biome-ignore-all format: compact closed request table stays below the repository limit

import { assertRunnerHoldRequest } from './owner-api-transport-hold.mjs';
import { API, assertState, fail } from './owner-api-transport-primitives.mjs';

export const OPERATIONS = Object.freeze(['list-attestation-runs', 'dispatch-exact-run', 'read-exact-run', 'cancel-exact-run', 'read-failed-job-evidence', 'rerun-failed-exact-run', 'list-runner-inventory', 'read-exact-job', 'list-exact-artifacts', 'download-exact-artifact']);
const LISTS = new Set(['list-attestation-runs', 'read-failed-job-evidence', 'list-runner-inventory', 'read-exact-job', 'list-exact-artifacts']);
const integer = (value, name) => Number.isInteger(value) && value > 0 ? value : fail(`missing ${name}`);

function api(state, path, { method = 'GET', body } = {}) {
  return { method, url: `${API}/repos/${state.repository.name}${path}`, ...(body ? { body } : {}), apiVersion: '2026-03-10', redirects: 'error' };
}

export function assertApiRequest(state, request) {
  const url = new URL(request.url); const prefix = `/repos/${state.repository.name}/`;
  if (url.origin !== API || url.username || url.password || url.hash || !url.pathname.startsWith(prefix) || request.apiVersion !== '2026-03-10' || request.redirects !== 'error' || !['GET', 'POST'].includes(request.method)) fail('invalid API target');
}

function pageFor(state, operation) {
  const saved = state.pageCursors?.[operation];
  if (saved) return saved;
  return 1;
}

export function listPath(state, operation, page) {
  if (operation === 'list-attestation-runs') return `/actions/workflows/${encodeURIComponent(state.workflow.path)}/runs?event=workflow_dispatch&per_page=100&page=${page}`;
  if (operation === 'list-runner-inventory') return `/actions/runners?per_page=100&page=${page}`;
  if (operation === 'read-failed-job-evidence' || operation === 'read-exact-job') return `/actions/runs/${integer(state.run?.id, 'run')}/jobs?filter=latest&per_page=100&page=${page}`;
  if (operation === 'list-exact-artifacts') return `/actions/runs/${integer(state.run?.id, 'run')}/artifacts?per_page=100&page=${page}`;
  fail('invalid page route');
}

export function requestFor(state, operation) {
  assertState(state);
  if (!OPERATIONS.includes(operation)) fail('unknown operation');
  if (operation === 'list-runner-inventory') assertRunnerHoldRequest(state);
  if (operation === 'download-exact-artifact' && state.phase !== 'ARTIFACT_BOUND') fail('invalid artifact state');
  const current = LISTS.has(operation) ? pageFor(state, operation) : 1;
  const pageQuery = typeof current === 'string' ? current : undefined;
  const number = typeof current === 'number' ? current : undefined;
  const run = state.run; const workflow = encodeURIComponent(state.workflow.path);
  const request = operation === 'list-attestation-runs'
    ? api(state, pageQuery ?? listPath(state, operation, number))
    : operation === 'dispatch-exact-run'
      ? api(state, `/actions/workflows/${workflow}/dispatches`, { method: 'POST', body: { ref: 'main', inputs: { admission_id: state.admissionId } } })
      : operation === 'read-exact-run'
        ? api(state, `/actions/runs/${integer(run?.id, 'run')}`)
        : operation === 'cancel-exact-run'
          ? api(state, `/actions/runs/${integer(run?.id, 'run')}/cancel`, { method: 'POST' })
          : operation === 'read-failed-job-evidence' || operation === 'read-exact-job'
            ? api(state, pageQuery ?? listPath(state, operation, number))
            : operation === 'rerun-failed-exact-run'
              ? api(state, `/actions/runs/${integer(run?.id, 'run')}/rerun-failed-jobs`, { method: 'POST' })
              : operation === 'list-runner-inventory'
                ? api(state, pageQuery ?? listPath(state, operation, number))
                : operation === 'list-exact-artifacts'
                  ? api(state, pageQuery ?? listPath(state, operation, number))
                  : api(state, `/actions/artifacts/${integer(state.artifact?.id, 'artifact')}/zip`);
  assertApiRequest(state, request);
  return request;
}
