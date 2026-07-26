import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { sealTransportPolicy } from './owner-api-transport-http.mjs';
import { canonical, hash } from './owner-api-transport-primitives.mjs';
import {
  bindArtifactPlan,
  parseRedirectLocation,
  parseTransportArgs,
  readRootFailureEnvelope,
  readRunnerHoldEnvelope,
} from './owner-api-transport-runtime.mjs';

const policyFileSha256 = 'c'.repeat(64);
const transportPolicy = sealTransportPolicy(
  {
    allowedQueryKeys: [
      'rscd',
      'rsct',
      'se',
      'sig',
      'ske',
      'skoid',
      'sks',
      'skt',
      'sktid',
      'skv',
      'sp',
      'spr',
      'sr',
      'st',
      'sv',
    ],
    hostPattern: '^productionresultssa[0-9]+\\.blob\\.core\\.windows\\.net$',
    maxBytes: 1048576,
    pathPrefix: '/actions-results/',
    timeoutsMs: {
      bodyInactivity: 10000,
      connect: 10000,
      headers: 10000,
      overall: 30000,
    },
  },
  policyFileSha256
);

function reader(files) {
  return (path) => {
    if (!(path in files)) throw new Error(`missing ${path}`);
    return files[path];
  };
}

function sidecar(bytes) {
  return hash(bytes);
}

function rootEnvelopeFiles(attempt = 1) {
  const root = '/transaction';
  const channel = Buffer.from(
    canonical({
      authenticated: true,
      channel: 'ssh-controller',
      receivedMonotonicMs: 1,
      transactionId: 'transaction-1',
    })
  );
  const runtime = Buffer.from('{"runtime":true}');
  const restore = Buffer.from('{"restore":true}');
  return {
    [`${root}/root-channel-attempt-${attempt}.json`]: channel,
    [`${root}/root-channel-attempt-${attempt}.sha256`]: sidecar(channel),
    [`${root}/root-terminal-runtime-attempt-${attempt}.json`]: runtime,
    [`${root}/root-terminal-runtime-attempt-${attempt}.sha256`]:
      sidecar(runtime),
    [`${root}/root-restore-attempt-${attempt}.json`]: restore,
    [`${root}/root-restore-attempt-${attempt}.sha256`]: sidecar(restore),
  };
}

function runnerHoldEnvelopeFiles(attempt = 1) {
  const root = '/transaction';
  const channel = Buffer.from(
    canonical({
      authenticated: true,
      channel: 'ssh-controller',
      receivedMonotonicMs: 1,
      transactionId: 'transaction-1',
    })
  );
  const hold = Buffer.from('{"hold":true}');
  return {
    [`${root}/root-runner-hold-channel-attempt-${attempt}.json`]: channel,
    [`${root}/root-runner-hold-channel-attempt-${attempt}.sha256`]:
      sidecar(channel),
    [`${root}/root-runner-hold-attempt-${attempt}.json`]: hold,
    [`${root}/root-runner-hold-attempt-${attempt}.sha256`]: sidecar(hold),
  };
}

test('has a closed owner transport CLI and rejects malformed invocation before reading a token', () => {
  assert.throws(() => parseTransportArgs([]), /invocation/);
  assert.deepEqual(
    parseTransportArgs([
      '--operation',
      'list-attestation-runs',
      '--state',
      '/state',
      '--state-sha256',
      '/sha',
      '--token-fd',
      '0',
    ]),
    {
      kind: 'operation',
      operation: 'list-attestation-runs',
      statePath: '/state',
      stateShaPath: '/sha',
    }
  );
  const result = spawnSync(process.execPath, ['owner-api-transport.mjs'], {
    cwd: new URL('.', import.meta.url),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refused/);
});

test('rejects substituted root runtime and restore sidecar digests before returning the envelope', () => {
  const files = rootEnvelopeFiles();
  files['/transaction/root-terminal-runtime-attempt-1.sha256'] = 'b'.repeat(64);
  assert.throws(
    () => readRootFailureEnvelope('/transaction/state.json', 1, reader(files)),
    /invalid authenticated root receipt/
  );
  files['/transaction/root-terminal-runtime-attempt-1.sha256'] = sidecar(
    files['/transaction/root-terminal-runtime-attempt-1.json']
  );
  files['/transaction/root-restore-attempt-1.sha256'] =
    `${sidecar(files['/transaction/root-restore-attempt-1.json'])}\n`;
  assert.throws(
    () => readRootFailureEnvelope('/transaction/state.json', 1, reader(files)),
    /invalid authenticated root receipt/
  );
});

test('reads only the attempt-qualified root failure envelope for attempts one and two', () => {
  for (const attempt of [1, 2]) {
    const files = rootEnvelopeFiles(attempt);
    const envelope = readRootFailureEnvelope(
      '/transaction/state.json',
      attempt,
      reader(files)
    );
    assert.equal(envelope.runtimeBytes.toString('utf8'), '{"runtime":true}');
    assert.equal(envelope.restoreBytes.toString('utf8'), '{"restore":true}');
    assert.throws(
      () =>
        readRootFailureEnvelope(
          '/transaction/state.json',
          attempt === 1 ? 2 : 1,
          reader(files)
        ),
      /missing/
    );
  }
  assert.throws(
    () => readRootFailureEnvelope('/transaction/state.json', 3, reader({})),
    /attempt/
  );
});

test('rejects an invalid or mismatched runner-hold sidecar before returning the envelope', () => {
  const files = runnerHoldEnvelopeFiles();
  files['/transaction/root-runner-hold-attempt-1.sha256'] = 'A'.repeat(64);
  assert.throws(
    () => readRunnerHoldEnvelope('/transaction/state.json', 1, reader(files)),
    /invalid authenticated runner hold/
  );
  files['/transaction/root-runner-hold-attempt-1.sha256'] = 'b'.repeat(64);
  assert.throws(
    () => readRunnerHoldEnvelope('/transaction/state.json', 1, reader(files)),
    /invalid authenticated runner hold/
  );
});

test('reads only the attempt-qualified runner hold envelope for attempts one and two', () => {
  for (const attempt of [1, 2]) {
    const files = runnerHoldEnvelopeFiles(attempt);
    const envelope = readRunnerHoldEnvelope(
      '/transaction/state.json',
      attempt,
      reader(files)
    );
    assert.equal(envelope.holdBytes.toString('utf8'), '{"hold":true}');
    assert.equal(envelope.holdSha256, sidecar(envelope.holdBytes));
    assert.throws(
      () =>
        readRunnerHoldEnvelope(
          '/transaction/state.json',
          attempt === 1 ? 2 : 1,
          reader(files)
        ),
      /missing/
    );
  }
  assert.throws(
    () => readRunnerHoldEnvelope('/transaction/state.json', 3, reader({})),
    /attempt/
  );
});

test('parses an artifact redirect location once and fails closed for a missing or malformed location', () => {
  assert.equal(
    parseRedirectLocation(
      'https://productionresultssa1.blob.core.windows.net/actions-results/a?sig=x'
    ).hostname,
    'productionresultssa1.blob.core.windows.net'
  );
  assert.throws(() => parseRedirectLocation(undefined), /invalid redirect/);
  assert.throws(
    () => parseRedirectLocation('://not-a-url'),
    /invalid redirect/
  );
});

test('binds artifact blob connect, header, body, and overall deadlines to sealed policy', () => {
  const state = {
    deadlineMonotonicMs: 12001,
    digests: { policy: policyFileSha256 },
    generation: 7,
    stateDigest: 'a'.repeat(64),
  };
  const redirect = new URL(
    'https://productionresultssa1.blob.core.windows.net/actions-results/a?sig=x'
  );
  assert.deepEqual(
    bindArtifactPlan(
      state,
      { address: '8.8.8.8' },
      redirect,
      redirect.href,
      2001,
      transportPolicy
    ),
    {
      address: '8.8.8.8',
      bodyInactivityTimeoutMs: 10000,
      connectDeadlineMonotonicMs: 12001,
      createdMonotonicMs: 2001,
      deadlineMonotonicMs: 12001,
      headersDeadlineMonotonicMs: 12001,
      maxBytes: 1048576,
      overallDeadlineMonotonicMs: 12001,
      path: '/actions-results/a?sig=x',
      redirectSha256: hash(redirect.href),
      stateDigest: state.stateDigest,
      stateGeneration: 7,
      transportPolicy: transportPolicy.policy,
      transportPolicyFileSha256: policyFileSha256,
      transportPolicySha256: transportPolicy.projectionSha256,
    }
  );
  assert.equal(
    bindArtifactPlan(
      state,
      { address: '8.8.8.8' },
      redirect,
      redirect.href,
      12000,
      transportPolicy
    ).overallDeadlineMonotonicMs,
    12001
  );
  assert.throws(
    () =>
      bindArtifactPlan(
        state,
        { address: '8.8.8.8' },
        redirect,
        redirect.href,
        12001,
        transportPolicy
      ),
    /deadline/
  );
});
