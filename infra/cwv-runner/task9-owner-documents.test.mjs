// biome-ignore-all format: closed root-document fixtures stay below the repository file limit
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  beginOperation,
  consumeResponse,
  createOwnerState,
  OPERATIONS,
} from './owner-api-transport.mjs';
import { canonical } from './owner-api-transport-primitives.mjs';
import {
  TRANSPORT_ENTRY,
  TRANSPORT_SOURCE_FILES,
} from './owner-api-transport-source.mjs';
import {
  admissionDocumentFrom,
  beginBindingFrom,
  inventoryDocumentFrom,
  parseOwnerDocumentArgs,
  rearmDocumentFrom,
  runOwnerDocumentCli,
} from './task9-owner-documents.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const source = () => ({
  generation: 1,
  operationSet: OPERATIONS,
  operationSetDigest: hash(canonical(OPERATIONS)),
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
function state() {
  const authorization = source();
  const bytes = Buffer.from(canonical(authorization));
  const initial = createOwnerState({
    sourceAuthorizationBytes: bytes,
    sourceAuthorizationSha256: hash(bytes),
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
  const row = {
    actor: { login: 'ogabasseyy' },
    created_at: '2026-07-21T20:00:00.000Z',
    display_title: `CWV Runner Attestation ${'b'.repeat(64)}`,
    event: 'workflow_dispatch',
    head_branch: 'main',
    head_sha: 'a'.repeat(40),
    html_url: 'https://github.com/ogabasseyy/Baci/actions/runs/9',
    id: 9,
    path: '.github/workflows/cwv-runner-attestation.yml',
    run_attempt: 1,
    status: 'queued',
    url: 'https://api.github.com/repos/ogabasseyy/Baci/actions/runs/9',
    workflow_id: 2,
  };
  const pre = consumeResponse(initial, 'list-attestation-runs', {
    status: 200,
    body: { total_count: 0, workflow_runs: [] },
  });
  const dispatched = consumeResponse(
    beginOperation(pre, 'dispatch-exact-run'),
    'dispatch-exact-run',
    {
      status: 200, receivedMonotonicMs: 2,
      body: { html_url: row.html_url, run_url: row.url, workflow_run_id: 9 },
    }
  );
  return consumeResponse(dispatched, 'list-attestation-runs', {
    status: 200,
    body: { total_count: 1, workflow_runs: [row] },
  });
}
function reseal(value, patch) {
  const { stateDigest: _ignored, ...unsigned } = value;
  const next = { ...unsigned, ...patch };
  return { ...next, stateDigest: hash(canonical(next)) };
}
function challenge(binding, kind) {
  const ttl = kind === 'admission' ? 30 : 5;
  return {
    bindingDigest: hash(canonical(binding)),
    campaignId: binding.campaignId,
    createdMonotonicSeconds: 10,
    deadlineMonotonicSeconds: 10 + ttl,
    kind,
    nonce: 'f'.repeat(64),
    schemaVersion: 1,
  };
}

test('derives the root begin binding and admission only from a sealed reconciled state and its exact challenge', () => {
  const value = state();
  const binding = beginBindingFrom(value);
  const rootChallenge = challenge(binding, 'admission');
  assert.deepEqual(binding, {
    admissionId: 'b'.repeat(64),
    campaignId: 'baci-cwv-1',
    expectedSha: 'a'.repeat(40),
    policyFileSha256: 'c'.repeat(64),
    repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
    run: { attempt: 1, id: 9 },
    workflow: {
      id: 2,
      job: 'attest',
      path: '.github/workflows/cwv-runner-attestation.yml',
      ref: 'refs/heads/main',
    },
  });
  assert.deepEqual(admissionDocumentFrom(value, rootChallenge), {
    admissionId: 'b'.repeat(64),
    campaignId: 'baci-cwv-1',
    challengeNonce: 'f'.repeat(64),
    kind: 'admission',
    ownerAudit: { capturedAt: '1970-01-01T00:00:00.000Z' },
    policyFileSha256: 'c'.repeat(64),
    reconciliation: {
      activeRunCount: 1,
      digest: value.postDispatchEvidence.responseSha256,
      stateGeneration: value.generation,
    },
    repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
    run: {
      actor: 'ogabasseyy',
      admissionId: 'b'.repeat(64),
      attempt: 1,
      displayTitle: `CWV Runner Attestation ${'b'.repeat(64)}`,
      event: 'workflow_dispatch',
      id: 9,
      status: 'queued',
    },
    schemaVersion: 1,
    workflow: {
      headSha: 'a'.repeat(40),
      id: 2,
      job: 'attest',
      path: '.github/workflows/cwv-runner-attestation.yml',
      ref: 'refs/heads/main',
    },
  });
  assert.throws(
    () => admissionDocumentFrom(value, { ...rootChallenge, extra: true }),
    /challenge/
  );
});

test('binds rerun attempt two consistently across state reconciliation and owner documents', () => {
  const value = state();
  const run = { ...value.run, attempt: 2 };
  const failedRootStateGeneration = value.generation - 2; const failureEvidence = { attempt: 1, code: 'RUNNER_TRANSPORT_LOST_BEFORE_ATTESTATION', createdAt: '2026-07-22T12:00:00.000Z', jobsDigest: '1'.repeat(64), restoreDigest: '2'.repeat(64), rootRuntimeDigest: '3'.repeat(64), rootStateGeneration: failedRootStateGeneration, runDigest: '4'.repeat(64), runId: run.id, schemaVersion: 1, stateGeneration: failedRootStateGeneration + 1 };
  const rerun = reseal(value, { failureEvidence, postDispatchEvidence: { ...value.postDispatchEvidence, run: { ...value.postDispatchEvidence.run, attempt: 2 } }, rerunUsed: true, run });
  assert.equal(failureEvidence.rootStateGeneration + 1, failureEvidence.stateGeneration);
  assert.deepEqual(beginBindingFrom(rerun).run, { attempt: 2, id: 9 });
  assert.deepEqual(rearmDocumentFrom(rerun, '5'.repeat(64)), { binding: beginBindingFrom(rerun), failureEvidence, ownerStateSha256: '5'.repeat(64), schemaVersion: 1, stateGeneration: rerun.generation });
  assert.throws(() => rearmDocumentFrom(reseal(rerun, { failureEvidence: { ...failureEvidence, stateGeneration: rerun.generation } }), '5'.repeat(64)), /rearm/);
  assert.throws(() => rearmDocumentFrom(reseal(rerun, { failureEvidence: { ...failureEvidence, rootStateGeneration: failureEvidence.rootStateGeneration + 1 } }), '5'.repeat(64)), /rearm/);
  const root = mkdtempSync(join(tmpdir(), 'task9-rearm-')); const statePath = join(root, 'state.json'); const stateShaPath = join(root, 'state.sha256'); const bytes = Buffer.from(canonical(rerun));
  try {
    writeFileSync(statePath, bytes); writeFileSync(stateShaPath, `${hash(bytes)}  task9-state.json\n`); writeFileSync(`${statePath}.generation`, `${Array.from({ length: rerun.generation + 1 }, (_entry, generation) => `${generation} ${generation === rerun.generation ? rerun.stateDigest : '0'.repeat(64)}`).join('\n')}\n`);
    assert.deepEqual(runOwnerDocumentCli(['--rearm', '--state', statePath, '--state-sha256', stateShaPath]), { binding: beginBindingFrom(rerun), failureEvidence, ownerStateSha256: hash(bytes), schemaVersion: 1, stateGeneration: rerun.generation });
    const cli = (mode) => spawnSync(process.execPath, [new URL('./task9-owner-documents.mjs', import.meta.url).pathname, mode, '--state', statePath, '--state-sha256', stateShaPath], { encoding: 'utf8' }); const begin = cli('--begin'); const rearm = cli('--rearm');
    assert.equal(begin.status, 0); assert.equal(rearm.status, 0); assert.equal(begin.stdout, canonical(beginBindingFrom(rerun))); assert.equal(rearm.stdout, canonical(rearmDocumentFrom(rerun, hash(bytes))));
    assert.equal(hash(Buffer.from(begin.stdout)), hash(Buffer.from(canonical(JSON.parse(rearm.stdout).binding))));
  } finally { rmSync(root, { force: true, recursive: true }); }
  assert.throws(() => beginBindingFrom(reseal(value, { postDispatchEvidence: { ...value.postDispatchEvidence, run: { ...value.postDispatchEvidence.run, attempt: 2 } }, run })), /reconciled/);
});

test('requires sealed full runner pages and an exact root hold output for the inventory projection', () => {
  const value = state();
  const binding = beginBindingFrom(value);
  const rootChallenge = challenge(binding, 'inventory');
  const hold = {
    challenge: rootChallenge,
    holdDigest: 'e'.repeat(64),
    identity: {
      campaignId: binding.campaignId,
      hostname: 'a'.repeat(12),
      runnerContainerId: 'd'.repeat(64),
      runnerIp: '172.24.0.2',
      runnerPeerIfindex: 17,
      runnerVeth: 'veth0',
    },
    liveSampleDigest: '9'.repeat(64),
    schemaVersion: 1,
  };
  assert.throws(() => inventoryDocumentFrom(value, hold), /inventory/);
  const sealed = reseal(value, {
    runnerEvidence: {
      boundStateGeneration: value.generation,
      challengeNonce: rootChallenge.nonce,
      holdDigest: hold.holdDigest,
      pages: [
        {
          next: null,
          number: 1,
          runners: [
            {
              architecture: 'X64',
              busy: false,
              id: 7,
              labels: ['Linux', 'X64', 'baci-cwv-measurement', 'self-hosted'],
              name: 'baci-cwv-measurement-01',
              os: 'linux',
              status: 'online',
            },
          ],
          totalCount: 1,
        },
      ],
      responseSha256: '3'.repeat(64),
      runnerId: 7,
    },
  });
  const document = inventoryDocumentFrom(sealed, hold);
  assert.equal(document.holdDigest, hold.holdDigest);
  assert.equal(document.pages[0].runners[0].generation, undefined);
  assert.throws(
    () =>
      inventoryDocumentFrom(sealed, {
        ...hold,
        identity: { ...hold.identity, extra: true },
      }),
    /hold/
  );
});

test('accepts only the closed CLI argument shapes and writes documents to stdout', () => {
  assert.deepEqual(
    parseOwnerDocumentArgs([
      '--begin',
      '--state',
      'state.json',
      '--state-sha256',
      'state.sha256',
    ]),
    {
      challengePath: undefined,
      holdPath: undefined,
      mode: 'begin',
      statePath: 'state.json',
      stateShaPath: 'state.sha256',
    }
  );
  assert.deepEqual(parseOwnerDocumentArgs(['--rearm', '--state', 'state.json', '--state-sha256', 'state.sha256']), { challengePath: undefined, holdPath: undefined, mode: 'rearm', statePath: 'state.json', stateShaPath: 'state.sha256' });
  assert.throws(
    () =>
      parseOwnerDocumentArgs([
        '--begin',
        '--state',
        'x',
        '--state-sha256',
        'y',
        '--output',
        'z',
      ]),
    /invocation/
  );
});
