// biome-ignore-all format: adversarial page fixture remains compact
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  completeRunnerPages,
  completeRunPages,
  consumeResponse,
  createArtifactDownloadPlan,
  createOwnerState,
  executeApiOperation,
  OPERATIONS,
  requestFor,
} from './owner-api-transport.mjs';
import {
  artifactEvidence,
  runnerEvidence,
} from './owner-api-transport-operation-evidence.mjs';
import { canonical, exact } from './owner-api-transport-primitives.mjs';
import { readValidatedToken } from './owner-api-transport-runtime.mjs';
import {
  TRANSPORT_ENTRY,
  TRANSPORT_SOURCE_FILES,
} from './owner-api-transport-source.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const artifactPolicy = { allowedQueryKeys: ['rscd', 'rsct', 'se', 'sig', 'ske', 'skoid', 'sks', 'skt', 'sktid', 'skv', 'sp', 'spr', 'sr', 'st', 'sv'], hostPattern: '^productionresultssa[0-9]+\\.blob\\.core\\.windows\\.net$', maxBytes: 1048576, pathPrefix: '/actions-results/', timeoutsMs: { bodyInactivity: 10000, connect: 10000, headers: 10000, overall: 30000 } };
const source = () => ({
  generation: 1,
  operationSet: OPERATIONS,
  operationSetDigest: digest(JSON.stringify(OPERATIONS)),
  policyFileSha256: 'c'.repeat(64),
  provenance: {
    manifestSha256: 'd'.repeat(64),
    nodeProvenanceSha256: '1'.repeat(64),
    runtimeSha256: 'f'.repeat(64),
    sourceArchiveSha256: '2'.repeat(64),
  },
  purpose: 'task9-exact-run',
  schemaVersion: 1,
  sourceBinding: {
    base: { ref: 'refs/heads/main', sha: '6'.repeat(40) },
    deploymentSha: 'a'.repeat(40),
    exactRun: {
      admissionId: 'b'.repeat(64),
      workflow: {
        id: 2,
        path: '.github/workflows/cwv-runner-attestation.yml',
        ref: 'refs/heads/main',
      },
    },
    mergeSha: '8'.repeat(40),
    pullRequest: { headRef: 'h0/task9', number: 9 },
    ref: 'refs/pull/9/merge',
    repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
    reviewedSha: '7'.repeat(40),
  },
  sourceFiles: TRANSPORT_SOURCE_FILES.map((path) => ({
    path,
    sha256: path === TRANSPORT_ENTRY ? 'e'.repeat(64) : '1'.repeat(64),
  })),
  transactionId: 'baci-cwv-1',
});
const state = () => {
  const bytes = Buffer.from(canonical(source()));
  return createOwnerState({
    sourceAuthorizationBytes: bytes,
    sourceAuthorizationSha256: digest(bytes),
    digests: {
      manifest: 'd'.repeat(64),
      policy: 'c'.repeat(64),
      runtime: 'f'.repeat(64),
      transport: 'e'.repeat(64),
    },
    createdMonotonicMs: 1,
    createdWallClockMs: 0,
    deadlineMonotonicMs: 1200001,
  });
};
const row = (id, patch = {}) => ({
  actor: { login: 'owner' },
  created_at: '2026-01-01T00:00:00Z',
  display_title: `CWV Runner Attestation ${'b'.repeat(64)}`,
  event: 'workflow_dispatch',
  id,
  status: 'completed',
  ...patch,
});

test('does not confuse comma-delimited object keys with a different key count', () => {
  assert.equal(exact({ 'a,b': 1, c: 2 }, ['a', 'b', 'c']), false);
});

test('requires bounded complete run pages and rejects an active workflow run even with a different admission title', () => {
  const first = {
    total_count: 101,
    workflow_runs: Array.from({ length: 100 }, (_, index) =>
      row(index + 1, { display_title: `other ${index}` })
    ),
  };
  const second = {
    total_count: 101,
    workflow_runs: [
      row(101, { display_title: 'unrelated title', status: 'in_progress' }),
    ],
  };
  const all = completeRunPages([first, second]);
  assert.equal(all.workflow_runs.length, 101);
  const target = 'https://api.github.com/repos/ogabasseyy/Baci/actions/workflows/.github%2Fworkflows%2Fcwv-runner-attestation.yml/runs?event=workflow_dispatch&per_page=100&page=2';
  const firstPage = consumeResponse(state(), 'list-attestation-runs', { status: 200, linkValues: [`<${target}>; rel="next", <${target}>; rel="last"`], body: first });
  assert.equal(firstPage.pageCursors['list-attestation-runs'], '/actions/workflows/.github%2Fworkflows%2Fcwv-runner-attestation.yml/runs?event=workflow_dispatch&per_page=100&page=2');
  assert.throws(
    () =>
      consumeResponse(firstPage, 'list-attestation-runs', {
        status: 200,
        body: second,
      }),
    /active/
  );
  assert.throws(
    () => completeRunPages([{ total_count: 101, workflow_runs: [] }]),
    /pages/
  );
});

test('requires the dispatch API version and wipes a mutable one-request token after send', async () => {
  assert.equal(
    requestFor(state(), 'list-attestation-runs').apiVersion,
    '2026-03-10'
  );
  const token = Buffer.from('one-time-token');
  await executeApiOperation({
    state: state(),
    operation: 'list-attestation-runs',
    persist: async (_previous, following) => ({
      generation: following.generation,
      stateDigest: following.stateDigest,
    }),
    tokenPipe: async () => token,
    send: ({ token: active }) => {
      assert.equal(active.toString('utf8'), 'one-time-token');
      return {
        body: { total_count: 0, workflow_runs: [] },
        peer: {
          answerSetDigest: digest('8.8.8.8'),
          answers: ['8.8.8.8'],
          hostname: 'api.github.com',
          remoteAddress: '8.8.8.8',
          servername: 'api.github.com',
        },
        status: 200,
      };
    },
  });
  assert.deepEqual(token, Buffer.alloc(token.length));
});

test('checks the exact operation request intent before consuming standard input', () => {
  let reads = 0;
  assert.throws(
    () =>
      readValidatedToken(state(), 'not-an-operation', () => {
        reads += 1;
        return Buffer.from('secret\n');
      }),
    /operation/
  );
  assert.equal(reads, 0);
});

test('rejects an identically named artifact whose publication metadata belongs to another workflow run', () => {
  const value = {
    ...state(),
    run: {
      attempt: 1,
      id: 9,
      runUrl: 'https://api.github.com/repos/ogabasseyy/Baci/actions/runs/9',
      htmlUrl: 'https://github.com/ogabasseyy/Baci/actions/runs/9',
    },
  };
  assert.throws(
    () =>
      artifactEvidence(value, {
        total_count: 1,
        artifacts: [
          {
            archive_download_url:
              'https://api.github.com/repos/ogabasseyy/Baci/actions/artifacts/13/zip',
            created_at: '2026-01-01T00:00:00.000Z',
            digest: 'f'.repeat(64),
            expired: false,
            expires_at: '2026-04-01T00:00:00.000Z',
            id: 13,
            name: 'h0-runner-attestation-9-1',
            node_id: 'MDg6QXJ0aWZhY3QxMw==',
            size_in_bytes: 100,
            updated_at: '2026-01-01T00:00:00.000Z',
            url: 'https://api.github.com/repos/ogabasseyy/Baci/actions/artifacts/13',
            workflow_run: {
              head_branch: 'main',
              head_repository_id: 1100488586,
              head_sha: 'a'.repeat(40),
              id: 10,
              repository_id: 1100488586,
            },
          },
        ],
      }),
    /artifact metadata/
  );
});

test('permits bounded irrelevant redirect headers but requires exactly one raw Location value', () => {
  const location =
    'https://productionresultssa1.blob.core.windows.net/actions-results/a?sig=x&sp=r';
  assert.equal(
    createArtifactDownloadPlan(
      state(),
      {
        headers: {
          date: 'Tue, 01 Jan 2026 00:00:00 GMT',
          location,
          server: 'github',
        },
        locationValues: [location],
        status: 302,
      },
      ['8.8.8.8'],
      artifactPolicy
    ).authorization,
    false
  );
  assert.throws(
    () =>
      createArtifactDownloadPlan(
        state(),
        {
          headers: { location },
          locationValues: [location, location],
          status: 302,
        },
        ['8.8.8.8'],
        artifactPolicy
      ),
    /redirect/
  );
});

test('retains only complete canonical runner pages with closed labels and a label-derived architecture', () => {
  const runner = (id) => ({
    busy: false,
    id,
    labels: ['Linux', 'X64', 'baci-cwv-measurement', 'self-hosted'],
    name: 'baci-cwv-measurement-01',
    os: 'linux',
    status: 'online',
  });
  const pages = completeRunnerPages([{ total_count: 1, runners: [runner(7)] }]);
  assert.deepEqual(pages.pages[0], {
    next: null,
    number: 1,
    runners: [{ architecture: 'X64', ...runner(7) }],
    totalCount: 1,
  });
  assert.throws(
    () =>
      completeRunnerPages([
        {
          total_count: 1,
          runners: [{ ...runner(7), labels: ['Linux'] }],
        },
      ]),
    /runner/
  );
  assert.throws(
    () => completeRunnerPages([{ total_count: 101, runners: [runner(7)] }]),
    /runner/
  );
});

test('binds pre-release runner evidence only while the dedicated runner is offline and idle', () => {
  const runner = (patch = {}) => ({ busy: false, id: 7, labels: ['Linux', 'X64', 'baci-cwv-measurement', 'self-hosted'], name: 'baci-cwv-measurement-01', os: 'linux', status: 'offline', ...patch });
  const body = (selected) => ({ runners: [selected], total_count: 1 });
  const hold = { boundStateGeneration: 2, challengeNonce: 'nonce', holdDigest: 'a'.repeat(64) };

  assert.throws(
    () => runnerEvidence(body(runner({ status: 'online' })), [], hold),
    /runner inventory/
  );
  assert.throws(
    () => runnerEvidence(body(runner({ busy: true })), [], hold), /runner inventory/
  );
  assert.equal(runnerEvidence(body(runner()), [], hold).runnerId, 7);
});
