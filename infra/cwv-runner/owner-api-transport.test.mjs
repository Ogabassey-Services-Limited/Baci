// biome-ignore-all format: focused test remains below the repository file limit
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { beginOperation, bindArtifactReadback, consumeResponse, createArtifactDownloadPlan, createOwnerState, createPinnedApiPlan, executeApiOperation, OPERATIONS, requestFor, validateArtifactRedirect, validatePinnedPeer } from './owner-api-transport.mjs';
import { canonical } from './owner-api-transport-primitives.mjs';
import { TRANSPORT_ENTRY, TRANSPORT_SOURCE_FILES } from './owner-api-transport-source.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const artifactPolicy = { allowedQueryKeys: ['rscd', 'rsct', 'se', 'sig', 'ske', 'skoid', 'sks', 'skt', 'sktid', 'skv', 'sp', 'spr', 'sr', 'st', 'sv'], hostPattern: '^productionresultssa[0-9]+\\.blob\\.core\\.windows\\.net$', maxBytes: 1048576, pathPrefix: '/actions-results/', timeoutsMs: { bodyInactivity: 10000, connect: 10000, headers: 10000, overall: 30000 } };
const authorization = () => ({
  schemaVersion: 1,
  purpose: 'task9-exact-run',
  generation: 1,
  transactionId: 'baci-cwv-1',
  operationSet: OPERATIONS,
  operationSetDigest: sha(JSON.stringify(OPERATIONS)),
  policyFileSha256: 'c'.repeat(64),
  provenance: {
    manifestSha256: 'd'.repeat(64),
    runtimeSha256: 'f'.repeat(64),
    nodeProvenanceSha256: '1'.repeat(64),
    sourceArchiveSha256: '2'.repeat(64),
  },
  sourceFiles: TRANSPORT_SOURCE_FILES.map((path) => ({ path, sha256: path === TRANSPORT_ENTRY ? 'e'.repeat(64) : '1'.repeat(64) })),
  sourceBinding: {
    repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
    ref: 'refs/pull/9/merge',
    base: { ref: 'refs/heads/main', sha: '6'.repeat(40) },
    reviewedSha: '7'.repeat(40),
    mergeSha: '8'.repeat(40),
    deploymentSha: 'a'.repeat(40),
    pullRequest: { number: 9, headRef: 'h0/task9' },
    exactRun: {
      admissionId: 'b'.repeat(64),
      workflow: {
        id: 2,
        path: '.github/workflows/cwv-runner-attestation.yml',
        ref: 'refs/heads/main',
      },
    },
  },
});
const state = (sourceAuthorization = authorization(), options = {}) => {
  const sourceAuthorizationBytes = Buffer.from(canonical(sourceAuthorization));
  return createOwnerState({
    sourceAuthorizationBytes,
    sourceAuthorizationSha256: options.digest ?? sha(sourceAuthorizationBytes),
    digests: {
      policy: 'c'.repeat(64),
      manifest: 'd'.repeat(64),
      transport: 'e'.repeat(64),
      runtime: 'f'.repeat(64),
    },
    createdMonotonicMs: 1,
    createdWallClockMs: 0,
    deadlineMonotonicMs: 1200001,
  });
};
const runRow = { actor: { login: 'ogabasseyy' }, created_at: '2026-01-01T00:00:00Z', display_title: `CWV Runner Attestation ${'b'.repeat(64)}`, event: 'workflow_dispatch', head_branch: 'main', head_sha: 'a'.repeat(40), html_url: 'https://github.com/ogabasseyy/Baci/actions/runs/9', id: 9, path: '.github/workflows/cwv-runner-attestation.yml', run_attempt: 1, status: 'queued', url: 'https://api.github.com/repos/ogabasseyy/Baci/actions/runs/9', workflow_id: 2 };
const dispatchResponse = { status: 200, receivedMonotonicMs: 19, body: { html_url: runRow.html_url, run_url: runRow.url, workflow_run_id: 9 } };
const ready = (value) => consumeResponse(value, 'list-attestation-runs', { status: 200, body: { total_count: 0, workflow_runs: [] } });
const bound = (value) => { const accepted = consumeResponse(beginOperation(ready(value), 'dispatch-exact-run'), 'dispatch-exact-run', dispatchResponse); return consumeResponse(accepted, 'list-attestation-runs', { status: 200, body: { total_count: 1, workflow_runs: [runRow] } }); };
const reseal = (value, patch) => { const { stateDigest: _ignored, ...unsigned } = { ...value, ...patch }; return { ...unsigned, stateDigest: sha(canonical(unsigned)) }; };
test('freezes the exact source-authorized Task 9 repository, workflow, and operation set', () => {
  assert.deepEqual(OPERATIONS, ['list-attestation-runs', 'dispatch-exact-run', 'read-exact-run', 'cancel-exact-run', 'read-failed-job-evidence', 'rerun-failed-exact-run', 'list-runner-inventory', 'read-exact-job', 'list-exact-artifacts', 'download-exact-artifact']);
  const request = requestFor(state(), 'dispatch-exact-run');
  assert.deepEqual(request.body, { ref: 'main', inputs: { admission_id: 'b'.repeat(64) } });
  assert.throws(() => state({ ...authorization(), sourceBinding: { ...authorization().sourceBinding, repository: { id: 1, name: 'other/repo' } } }), /authorization/);
  assert.throws(() => state(authorization(), { digest: '0'.repeat(64) }), /authorization/);
  assert.throws(() => requestFor(state(), 'unknown'), /operation/);
});
test('uses durable READY, QUIESCENT, DISPATCH_ACCEPTED, and reconciled QUEUED states', () => {
  const initial = state();
  assert.equal(initial.phase, 'READY');
  const quiescent = ready(initial);
  assert.equal(quiescent.phase, 'QUIESCENT');
  const accepted = consumeResponse(beginOperation(quiescent, 'dispatch-exact-run'), 'dispatch-exact-run', dispatchResponse);
  assert.equal(accepted.phase, 'DISPATCH_ACCEPTED');
  assert.throws(() => consumeResponse(accepted, 'read-exact-run', { status: 200, body: { ...runRow, conclusion: null } }), /unexpected/);
  const delayed = consumeResponse(accepted, 'list-attestation-runs', { status: 200, body: { total_count: 0, workflow_runs: [] } });
  assert.equal(delayed.phase, 'DISPATCH_ACCEPTED');
  assert.equal(delayed.run.id, dispatchResponse.body.workflow_run_id);
  assert.throws(() => consumeResponse(accepted, 'list-attestation-runs', { status: 200, body: { total_count: 1, workflow_runs: [{ ...runRow, display_title: 'other', id: 10 }] } }), /ambiguous/);
  assert.throws(() => beginOperation(delayed, 'list-attestation-runs', delayed.queueDeadlineMonotonicMs + 1), /queue deadline/);
  assert.equal(consumeResponse(delayed, 'list-attestation-runs', { status: 200, body: { total_count: 1, workflow_runs: [runRow] } }).phase, 'QUEUED');
});
test('writes DISPATCH_INTENT before the request, binds the required 200 run receipt, and never repeats an ambiguous mutation', async () => {
  const writes = [];
  const persist = (previous, next) => {
    writes.push({ previous, next });
    return { generation: next.generation, stateDigest: next.stateDigest };
  };
  const next = await executeApiOperation({
    state: ready(state()),
    operation: 'dispatch-exact-run',
    persist,
    tokenPipe: async () => Buffer.from('not-recorded'),
    send: ({ request }) => {
      assert.equal(request.url, 'https://api.github.com/repos/ogabasseyy/Baci/actions/workflows/.github%2Fworkflows%2Fcwv-runner-attestation.yml/dispatches');
      assert.equal(writes[0].next.phase, 'DISPATCH_INTENT');
      return {
        ...dispatchResponse,
        peer: {
          answerSetDigest: sha('8.8.8.8'), hostname: 'api.github.com',
          servername: 'api.github.com',
          remoteAddress: '8.8.8.8',
          answers: ['8.8.8.8'],
        },
      };
    },
  });
  assert.equal(next.phase, 'DISPATCH_ACCEPTED');
  assert.equal(next.run.id, 9);
  assert.equal(next.run.queuedSinceMonotonicMs, 19);
  assert.deepEqual(writes.map(({ next: value }) => value.phase), ['DISPATCH_INTENT', 'DISPATCH_ACCEPTED']);
  assert.throws(() => beginOperation(writes[0].next, 'dispatch-exact-run'), /ambiguous/);
});
test('rejects a dispatch response that omits the exact run receipt or uses the legacy empty status', () => {
  const intent = beginOperation(ready(state()), 'dispatch-exact-run');
  assert.throws(() => consumeResponse(intent, 'dispatch-exact-run', { status: 204 }), /dispatch/);
  assert.throws(() => consumeResponse(intent, 'dispatch-exact-run', { status: 200, body: { ...dispatchResponse.body, extra: true }, receivedMonotonicMs: 19 }), /dispatch/);
});
test('requires the documented empty cancellation receipt', () => {
  const intent = beginOperation(bound(state()), 'cancel-exact-run');
  const accepted = consumeResponse(intent, 'cancel-exact-run', { status: 202, body: undefined, receivedMonotonicMs: 2 });
  assert.equal(accepted.phase, 'CANCEL_ACCEPTED');
  assert.deepEqual(accepted.cancelAcceptedEvidence, { acceptedMonotonicMs: 2, attempts: [1], runId: 9, status: 202 });
  assert.throws(() => consumeResponse(intent, 'cancel-exact-run', { status: 202, body: { accepted: true }, receivedMonotonicMs: 2 }), /cancellation/);
});

test('records an ambiguous dispatch as durable indeterminate state and forbids another POST', async () => {
  const writes = [];
  await assert.rejects(() => executeApiOperation({
      state: ready(state()), operation: 'dispatch-exact-run',
      persist: (_previous, following) => {
        writes.push(following);
        return { generation: following.generation, stateDigest: following.stateDigest };
      },
      tokenPipe: async () => Buffer.from('one-request-token'),
      send: () => { throw new Error('connection reset after write'); },
    }), /connection reset/);
  assert.deepEqual(writes.map((value) => value.phase), ['DISPATCH_INTENT', 'DISPATCH_INDETERMINATE']);
  assert.equal(writes[1].dispatchIntent.admissionId, 'b'.repeat(64));
  assert.throws(() => beginOperation(writes[1], 'dispatch-exact-run'), /ambiguous/);
  assert.equal(consumeResponse(writes[1], 'list-attestation-runs', { status: 200, receivedMonotonicMs: 20, body: { total_count: 1, workflow_runs: [runRow] } }).phase, 'QUEUED');
});
test('keeps a dispatch recoverable when network preparation fails before send begins', async () => {
  for (const failure of [
    { prepare: () => Promise.reject(new Error('prepare failed')), persistNetworkPlan: () => Promise.resolve({}) },
    { prepare: () => Promise.resolve({ hostname: 'api.github.com' }), persistNetworkPlan: () => Promise.reject(new Error('plan persistence failed')) },
  ]) {
    const writes = [];
    await assert.rejects(() => executeApiOperation({
      state: ready(state()), operation: 'dispatch-exact-run',
      persist: (_previous, following) => { writes.push(following); return { generation: following.generation, stateDigest: following.stateDigest }; },
      tokenPipe: () => Promise.reject(new Error('token pipe must not be read')),
      send: () => { throw new Error('send must not begin'); },
      persistNetworkPlan: failure.persistNetworkPlan,
      prepare: failure.prepare,
    }), /failed/);
    assert.deepEqual(writes.map((value) => value.phase), ['DISPATCH_INTENT']);
  }
});
test('reconciles the sole post-dispatch run and rejects a generic failed-job rerun classification', () => {
  let next = bound(state());
  assert.deepEqual(next.run, {
    actor: 'ogabasseyy', admissionId: 'b'.repeat(64), attempt: 1,
    displayTitle: `CWV Runner Attestation ${'b'.repeat(64)}`,
    event: 'workflow_dispatch', id: 9,
    runUrl: 'https://api.github.com/repos/ogabasseyy/Baci/actions/runs/9',
    htmlUrl: 'https://github.com/ogabasseyy/Baci/actions/runs/9', queuedSinceMonotonicMs: 19, status: 'queued',
  });
  next = consumeResponse(next, 'read-exact-run', { status: 200, body: { ...runRow, status: 'completed', conclusion: 'failure' } });
  assert.throws(() => consumeResponse(next, 'read-failed-job-evidence', { status: 200, body: { total_count: 1, jobs: [{ id: 11, run_id: 9, name: 'attest', status: 'completed', conclusion: 'failure' }] } }), /failed job/);
  assert.throws(() => beginOperation(next, 'rerun-failed-exact-run'), /rerun/);
});
test('proves zero active exact runs from actor, event, title, admission, creation, and status evidence before dispatch', () => {
  const active = { actor: { login: 'owner' }, created_at: '2026-01-01T00:00:00Z', display_title: 'another admission', event: 'workflow_dispatch', id: 17, status: 'in_progress' };
  assert.throws(() => consumeResponse(state(), 'list-attestation-runs', { status: 200, body: { total_count: 1, workflow_runs: [active] } }), /active workflow run/);
  assert.throws(() => beginOperation(state(), 'dispatch-exact-run'), /ambiguous dispatch/);
  const clear = ready(state());
  assert.equal(clear.preDispatchEvidence.zeroActiveExactRuns, true);
  assert.equal(beginOperation(clear, 'dispatch-exact-run').phase, 'DISPATCH_INTENT');
});
test('rejects runner, success-job, and artifact evidence outside their exact phases', () => {
  const value = bound(state());
  assert.throws(() => requestFor(value, 'list-runner-inventory'), /hold/);
  assert.throws(() => consumeResponse(value, 'read-exact-job', { status: 200, body: { total_count: 0, jobs: [] } }), /job/);
  assert.throws(() => consumeResponse(value, 'list-exact-artifacts', { status: 200, body: { total_count: 0, artifacts: [] } }), /artifact/);
});
test('does not read the one-request token pipe until the fixed API target is valid', async () => {
  let reads = 0;
  await assert.rejects(
    () =>
      executeApiOperation({
        state: state(),
        operation: 'unknown',
        persist: () => ({}),
        tokenPipe: () => {
          reads += 1;
          return 'no';
        },
        send: () => ({}),
      }),
    /operation/
  );
  assert.equal(reads, 0);
});
test('pins TLS peer addresses to the fully public DNS answer set and allows one credential-free artifact redirect', () => {
  assert.deepEqual(
    validatePinnedPeer({
      answerSetDigest: sha('1.1.1.1,8.8.8.8'),
      hostname: 'api.github.com',
      servername: 'api.github.com',
      remoteAddress: '8.8.8.8',
      answers: ['1.1.1.1', '8.8.8.8'],
    }),
    ['1.1.1.1', '8.8.8.8']
  );
  assert.throws(
    () =>
      validatePinnedPeer({
        answerSetDigest: sha('127.0.0.1'),
        hostname: 'api.github.com',
        servername: 'api.github.com',
        remoteAddress: '127.0.0.1',
        answers: ['127.0.0.1'],
      }),
    /address/
  );
  assert.throws(
    () =>
      validatePinnedPeer({
        answerSetDigest: sha('10.0.0.1,8.8.8.8'),
        hostname: 'api.github.com',
        servername: 'api.github.com',
        remoteAddress: '8.8.8.8',
        answers: ['8.8.8.8', '10.0.0.1'],
      }),
    /address/
  );
  const redirect = validateArtifactRedirect(state(), 'https://productionresultssa1.blob.core.windows.net/actions-results/a?sig=x&sp=r', ['8.8.8.8'], artifactPolicy);
  assert.equal(redirect.hostname, 'productionresultssa1.blob.core.windows.net');
  assert.throws(() => validateArtifactRedirect(state(), 'https://productionresultssa1.blob.core.windows.net/actions-results/a?sig=x&sp=r#fragment', ['8.8.8.8'], artifactPolicy), /redirect/);
  assert.throws(() => validateArtifactRedirect(state(), 'https://productionresultssa1.blob.core.windows.net/actions-results/a?sig=x&sp=r', ['8.8.8.8'], { ...artifactPolicy, allowedQueryKeys: ['sig'] }), /redirect/);
  assert.throws(() => validateArtifactRedirect(state(), 'https://productionresultssa1.blob.core.windows.net/actions-results/a?sig=x', ['8.8.8.8'], { ...artifactPolicy, pathPrefix: '/sealed-results/' }), /redirect/);
  assert.throws(() => validateArtifactRedirect(state(), 'https://productionresultssa1.blob.core.windows.net/actions-results/a?sig=x', ['8.8.8.8'], { ...artifactPolicy, hostPattern: '^productionresultssa2\\.blob\\.core\\.windows\\.net$' }), /redirect/);
});
test('produces direct-IP SNI API and one-hop credential-free artifact plans without redirect following', () => {
  const apiPlan = createPinnedApiPlan(state(), requestFor(state(), 'list-attestation-runs'), ['1.1.1.1', '8.8.8.8']);
  assert.deepEqual(apiPlan, {
    address: '1.1.1.1',
    answerSetDigest: sha('1.1.1.1,8.8.8.8'),
    answers: ['1.1.1.1', '8.8.8.8'],
    hostname: 'api.github.com',
    servername: 'api.github.com',
    hostHeader: 'api.github.com',
    maxRedirects: 0,
  });
  const plan = createArtifactDownloadPlan(
    state(),
    { status: 302, headers: { location: 'https://productionresultssa1.blob.core.windows.net/actions-results/a?sig=x&sp=r' }, locationValues: ['https://productionresultssa1.blob.core.windows.net/actions-results/a?sig=x&sp=r'] },
    ['8.8.8.8'],
    artifactPolicy
  );
  assert.deepEqual(plan, {
    address: '8.8.8.8',
    answerSetDigest: sha('8.8.8.8'),
    answers: ['8.8.8.8'],
    hostname: 'productionresultssa1.blob.core.windows.net',
    servername: 'productionresultssa1.blob.core.windows.net',
    hostHeader: 'productionresultssa1.blob.core.windows.net',
    authorization: false,
    maxRedirects: 0,
  });
  assert.throws(
    () =>
      createArtifactDownloadPlan(
        state(),
        { status: 302, headers: { location: 'https://productionresultssa1.blob.core.windows.net/actions-results/a?sig=x&sp=r' }, locationValues: ['https://productionresultssa1.blob.core.windows.net/actions-results/a?sig=x&sp=r'], redirects: 1 },
        ['8.8.8.8'],
        artifactPolicy
      ),
    /redirect/
  );
});

test('derives the private runner identity binding from the public runner without expanding public digests', () => {
  const runner = { generation: 3, id: 7, name: 'baci-cwv-measurement-01' }; const runnerIdentitySha256 = sha(canonical(runner));
  const artifact = { createdAt: '2026-01-01T00:00:00.000Z', digest: '1'.repeat(64), expiresAt: '2026-04-01T00:00:00.000Z', id: 5, lifetimeMilliseconds: 7776000000, name: 'h0-runner-attestation-9-1' };
  const value = reseal(state(), { artifact, phase: 'ARTIFACT_BOUND', run: { attempt: 1, id: 9 } });
  const publicValue = { digests: { restoreSha256: '9'.repeat(64) }, runner, schemaVersion: 1, workflow: { headSha: value.expectedSha } }; const memberBytes = Buffer.from(canonical(publicValue));
  const after = bindArtifactReadback(value, { archiveBytes: Buffer.from('archive'), memberBytes, readback: { artifact, public: publicValue } });
  assert.equal(after.ownerEvidenceHandoff.runnerIdentitySha256, runnerIdentitySha256);
  const tampered = { ...publicValue, runner: { ...runner, id: -1 } }; const tamperedBytes = Buffer.from(canonical(tampered));
  assert.throws(() => bindArtifactReadback(value, { archiveBytes: Buffer.from('archive'), memberBytes: tamperedBytes, readback: { artifact, public: tampered } }), /runner identity/);
});
