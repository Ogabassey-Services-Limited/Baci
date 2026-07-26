// biome-ignore-all format: compact finite inventory evidence stays below the repository file limit

import { appendCollectionPage } from './owner-api-transport-pagination.mjs';
import {
  canonical,
  exact,
  fail,
  hash,
  object,
} from './owner-api-transport-primitives.mjs';

const created = (value) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const responseHash = (value) => hash(JSON.stringify(value));
const RUNNER_LABELS = ['Linux', 'X64', 'baci-cwv-measurement', 'self-hosted'];
const RUNNER_PAGE_SIZE = 100;
const MAX_RUNNER_PAGES = 10;
const JOB_KEYS = ['check_run_url', 'completed_at', 'conclusion', 'created_at', 'head_branch', 'head_sha', 'html_url', 'id', 'labels', 'name', 'node_id', 'run_attempt', 'run_id', 'run_url', 'runner_group_id', 'runner_group_name', 'runner_id', 'runner_name', 'started_at', 'status', 'steps', 'url', 'workflow_name'];

function labelsFrom(value) {
  if (!Array.isArray(value)) fail('invalid runner inventory');
  const labels = value.map((label) => {
    if (typeof label === 'string') return label;
    if (
      !exact(label, ['id', 'name', 'type']) ||
      !Number.isInteger(label.id) ||
      label.id < 1 ||
      typeof label.name !== 'string' ||
      typeof label.type !== 'string'
    )
      fail('invalid runner inventory');
    return label.name;
  });
  const sorted = [...labels].sort();
  if (!sorted.length || sorted.length > 32 || new Set(sorted).size !== sorted.length || sorted.some((label) => !/^[A-Za-z0-9_.-]{1,64}$/.test(label))) fail('invalid runner inventory');
  return sorted;
}

function runnerRow(value) {
  if (
    !exact(value, ['busy', 'id', 'labels', 'name', 'os', 'status']) ||
    !Number.isInteger(value.id) ||
    value.id < 1 ||
    typeof value.name !== 'string' ||
    typeof value.status !== 'string' ||
    typeof value.busy !== 'boolean' ||
    typeof value.os !== 'string'
  )
    fail('invalid runner inventory');
  const labels = labelsFrom(value.labels);
  const architectures = labels.filter((label) => ['X64', 'ARM64', 'ARM'].includes(label));
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(value.name) || !/^[a-z0-9_-]{1,32}$/.test(value.os) || !['online', 'offline'].includes(value.status) || architectures.length !== 1) fail('invalid runner inventory');
  if (labels.includes('baci-cwv-measurement') && (value.name !== 'baci-cwv-measurement-01' || value.os !== 'linux' || canonical(labels) !== canonical(RUNNER_LABELS))) fail('invalid runner inventory');
  return {
    architecture: architectures[0],
    busy: value.busy,
    id: value.id,
    labels,
    name: value.name,
    os: value.os,
    status: value.status,
  };
}

export function completeRunnerPages(pages) {
  if (!Array.isArray(pages) || !pages.length || pages.length > MAX_RUNNER_PAGES)
    fail('invalid runner inventory');
  const total = pages[0]?.total_count;
  if (
    !Number.isInteger(total) ||
    total < 0 ||
    total > MAX_RUNNER_PAGES * RUNNER_PAGE_SIZE ||
    pages.length !== Math.max(1, Math.ceil(total / RUNNER_PAGE_SIZE))
  )
    fail('incomplete runner inventory');
  const records = pages.map((page, index) => {
    const size =
      index + 1 === pages.length
        ? total - index * RUNNER_PAGE_SIZE
        : RUNNER_PAGE_SIZE;
    if (
      !exact(page, ['runners', 'total_count']) ||
      page.total_count !== total ||
      !Array.isArray(page.runners) ||
      page.runners.length !== size
    )
      fail('invalid runner inventory');
    return {
      next:
        index + 1 === pages.length
          ? null
          : `/repos/ogabasseyy/Baci/actions/runners?per_page=100&page=${index + 2}`,
      number: index + 1,
      runners: page.runners.map(runnerRow),
      totalCount: total,
    };
  });
  const runners = records.flatMap((page) => page.runners);
  if (new Set(runners.map((row) => row.id)).size !== runners.length)
    fail('invalid runner inventory');
  return { pages: records, total_count: total, runners };
}

export const appendRunnerPage = (state, response) => appendCollectionPage(state, 'list-runner-inventory', response, 'runners');

export function runnerEvidence(body, proofs, hold) {
  const normalized = exact(body, ['pages', 'runners', 'total_count'])
    ? body
    : completeRunnerPages([body]);
  if (
    !Array.isArray(normalized.pages) ||
    !Array.isArray(normalized.runners) ||
    !Number.isInteger(normalized.total_count) ||
    normalized.runners.length !== normalized.total_count
  )
    fail('invalid runner inventory');
  const matching = normalized.runners.filter(
    (row) => row.labels.includes('baci-cwv-measurement')
  );
  if (
    matching.length !== 1 ||
    !hold ||
    matching[0].status !== 'offline' ||
    matching[0].busy !== false
  )
    fail('invalid runner inventory');
  return {
    boundStateGeneration: hold.boundStateGeneration,
    challengeNonce: hold.challengeNonce,
    holdDigest: hold.holdDigest,
    pages: normalized.pages,
    responseSha256: hash(canonical({ body: normalized, proofs })),
    runnerId: matching[0].id,
  };
}

export function failedJobEvidence(state, body) {
  if (
    !exact(body, ['jobs', 'total_count']) ||
    !Array.isArray(body.jobs) ||
    body.jobs.length > 100 ||
    !Number.isInteger(body.total_count)
  )
    fail('invalid failed job evidence');
  const matching = body.jobs.filter(
    (job) =>
      object(job) &&
      job.run_id === state.run?.id &&
      job.name === 'attest' &&
      job.status === 'completed' &&
      job.conclusion === 'failure' &&
      Number.isInteger(job.id)
  );
  if (matching.length !== 1) fail('invalid failed job evidence');
  return { jobId: matching[0].id, responseSha256: responseHash(body) };
}

export function exactJobEvidence(state, body, proofs = []) {
  if (!exact(body, ['jobs', 'total_count']) || !Array.isArray(body.jobs) || body.jobs.length !== body.total_count || !Number.isInteger(body.total_count) || body.total_count < 1) fail('invalid job evidence');
  const matching = body.jobs.filter((job) => job?.run_id === state.run?.id && job?.run_attempt === state.run?.attempt && job?.name === 'attest');
  const job = matching[0];
  if (matching.length !== 1 || !exact(job, JOB_KEYS) || !Number.isInteger(job.id) || job.id < 1 || job.status !== 'completed' || job.conclusion !== 'success' || job.head_branch !== 'main' || job.head_sha !== state.expectedSha || job.runner_id !== state.runnerEvidence?.runnerId || job.runner_name !== 'baci-cwv-measurement-01' || canonical(job.labels) !== canonical(['self-hosted', 'baci-cwv-measurement']) || !Array.isArray(job.steps) || !job.steps.length || job.steps.some((step) => !exact(step, ['completed_at', 'conclusion', 'name', 'number', 'started_at', 'status']) || step.status !== 'completed' || step.conclusion !== 'success' || !Number.isInteger(step.number) || !Number.isFinite(Date.parse(step.started_at)) || !Number.isFinite(Date.parse(step.completed_at)))) fail('invalid job evidence');
  return { jobId: job.id, responseSha256: hash(canonical({ body, proofs })) };
}

export function artifactEvidence(state, body, proofs = []) {
  if (
    !exact(body, ['artifacts', 'total_count']) ||
    !Array.isArray(body.artifacts) ||
    body.artifacts.length > 100 ||
    !Number.isInteger(body.total_count)
  )
    fail('invalid artifact metadata');
  const expected = `h0-runner-attestation-${state.run?.id}-${state.run?.attempt}`;
  const rows = body.artifacts.filter((row) => row?.name === expected);
  const row = rows[0];
  if (
    rows.length !== 1 ||
    !exact(row, [
      'archive_download_url',
      'created_at',
      'digest',
      'expired',
      'expires_at',
      'id',
      'name',
      'node_id',
      'size_in_bytes',
      'updated_at',
      'url',
      'workflow_run',
    ]) ||
    !Number.isInteger(row?.id) ||
    typeof row?.node_id !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/.test(row.digest) ||
    row.expired !== false ||
    !created(row.created_at) ||
    !created(row.expires_at) ||
    !created(row.updated_at) ||
    !Number.isInteger(row.size_in_bytes) ||
    row.size_in_bytes < 0 ||
    row.size_in_bytes > 1024 * 1024 ||
    row.url !==
      `https://api.github.com/repos/${state.repository.name}/actions/artifacts/${row.id}` ||
    row.archive_download_url !== `${row.url}/zip` ||
    !exact(row.workflow_run, [
      'head_branch',
      'head_repository_id',
      'head_sha',
      'id',
      'repository_id',
    ]) ||
    row.workflow_run.id !== state.run?.id ||
    row.workflow_run.head_branch !== 'main' ||
    row.workflow_run.head_sha !== state.expectedSha ||
    row.workflow_run.repository_id !== state.repository.id ||
    row.workflow_run.head_repository_id !== state.repository.id ||
    Date.parse(row.created_at) < state.createdWallClockMs ||
    Date.parse(row.updated_at) < Date.parse(row.created_at) ||
    Date.parse(row.expires_at) - Date.parse(row.created_at) < 90 * 86400 * 1000 - 300000 ||
    Date.parse(row.expires_at) - Date.parse(row.created_at) > 90 * 86400 * 1000 + 300000
  )
    fail('invalid artifact metadata');
  return {
    artifact: {
      createdAt: row.created_at,
      digest: row.digest,
      expiresAt: row.expires_at,
      id: row.id,
      lifetimeMilliseconds: Date.parse(row.expires_at) - Date.parse(row.created_at),
      name: expected,
    },
    artifactResponseSha256: hash(canonical({ body, proofs })),
  };
}
