import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildRunnerAttestation, canonicalJson } from './host-attestation.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const hash = (value) => sha256(canonicalJson(value));
const imageId = `sha256:${'a'.repeat(64)}`;
const contract = JSON.parse(
  readFileSync(new URL('./identity-contract.json', import.meta.url), 'utf8')
);
const sharedFiles = [
  { path: 'bin/Runner.Listener', sha256: '1'.repeat(64) },
  { path: 'bin/Runner.Worker', sha256: '2'.repeat(64) },
  { path: 'entrypoint.mjs', sha256: '3'.repeat(64) },
];

function source(name, value) {
  const canonical = canonicalJson(value);
  return {
    schemaVersion: 1,
    source: name,
    owner: { gid: 10001, mode: '0640', uid: 0 },
    canonical,
    sha256Receipt: `${sha256(canonical)}\n`,
  };
}

function drift(value) {
  if (typeof value === 'string') return `${value}-drift`;
  if (typeof value === 'number') return value + 1;
  if (typeof value === 'boolean') return !value;
  if (Array.isArray(value))
    return value.map((item, index) => (index === 0 ? drift(item) : item));
  const [key] = Object.keys(value);
  return { ...value, [key]: drift(value[key]) };
}

function validSources() {
  const github = {
    repository: { id: 1100488586, url: 'https://github.com/ogabasseyy/Baci' },
    runner: {
      authorityMode: 'personal-public-exact-run',
      controllerGeneration: 1,
      id: 41,
      labels: ['Linux', 'X64', 'baci-cwv-measurement', 'self-hosted'],
      name: 'baci-cwv-measurement-01',
      os: 'linux',
    },
    schemaVersion: 1,
  };
  const hostRunner = {
    files: [{ path: '.runner', sha256: '4'.repeat(64) }, ...sharedFiles],
    runner: {
      generation: 1,
      id: 41,
      name: 'baci-cwv-measurement-01',
    },
  };
  const runtimeRunner = { files: sharedFiles, version: '2.335.1' };
  const host = {
    hostIdentity: {
      cgroupDocker: contract.fields.cgroupDocker.expectation,
      controlCgroup: contract.fields.controlCgroup,
      cpuFreq: contract.fields.cpuFreq.expectation,
      cpuSummary: contract.fields.cpuSummary.expectation,
      cpuTopology: contract.fields.cpuTopology.expectation,
      dns: contract.fields.dns.expectation,
      egressProvider: contract.fields.egressProvider.expectation,
      hostBinaries: contract.fields.hostBinaries.expectation,
      hostname: contract.fields.hostname.expectation,
      ipForward: contract.fields.ipForward.expectation,
      iptables: contract.fields.iptables.expectation,
      kernel: contract.fields.kernel.expectation,
      locale: contract.fields.locale.expectation,
      memory: contract.fields.memory.expectationKb,
      measurementCgroup: contract.fields.measurementCgroup,
      nft: {
        sha256: contract.fields.nft.expectation.sha256,
        version: contract.fields.nft.expectation.version,
      },
      osRelease: contract.fields.osRelease.expectation,
      publicEgress: contract.fields.publicEgress.expectation,
      rootFilesystem: contract.fields.rootFilesystem.expectation,
      route: contract.fields.route.expectation,
      timezone: contract.fields.timezone.expectation,
    },
    hostIdentityDigest: '',
    hostRunner,
    hostRunnerIdentityDigest: hash(hostRunner.runner),
    hostname: 'ogabassey',
    schemaVersion: 1,
  };
  host.hostIdentityDigest = hash(host.hostIdentity);
  const runtime = {
    chrome: {
      binarySha256: '5'.repeat(64),
      debianPackage: contract.builderSources.runtime.chrome.debianPackage,
      debianSha256:
        '83ed59c85878ebb8fa53915ebe7066cafc58d1c04c1c95449486e6f9d99a1efb',
      version: '150.0.7871.128',
    },
    imageId,
    node: { binarySha256: '6'.repeat(64), version: '24.18.0' },
    pnpm: {
      binarySha256: '7'.repeat(64),
      packageJsonSha256: '8'.repeat(64),
      packageProjection: contract.builderSources.runtime.pnpm.packageProjection,
      version: '11.7.0',
    },
    runtimeRunner,
    runtimeRunnerBinaryDigest: hash(runtimeRunner),
    schemaVersion: 1,
  };
  const image = {
    id: imageId,
    imageReceiptSha256: '9'.repeat(64),
    platform: 'linux/amd64',
    runtimeIdentitySha256: hash(runtime),
    runtimeManifestSha256: 'e'.repeat(64),
    schemaVersion: 1,
  };
  return {
    github: source('github', github),
    host: source('host', host),
    image: source('image', image),
    policy: source('policy', {
      authorityMode: 'personal-public-exact-run',
      namespace: 'baci_cwv_measurement',
      policyFileSha256: 'a'.repeat(64),
      schemaVersion: 1,
    }),
    runtime: source('runtime', runtime),
    service: source('service', {
      manifestSha256: 'b'.repeat(64),
      schemaVersion: 1,
      unitSha256: 'c'.repeat(64),
    }),
  };
}

test('builds a stable attestation from canonical root-owned sources', () => {
  const attestation = buildRunnerAttestation(validSources());
  assert.equal(attestation.sha256, sha256(canonicalJson(attestation.identity)));
  assert.equal(attestation.identity.host.hostname, 'ogabassey');
  assert(
    !canonicalJson(attestation).match(
      /token|secret|password|credential|cookie/i
    )
  );
});

test('refuses missing, noncanonical, and substituted source receipts', () => {
  const sources = validSources();
  assert.throws(() => buildRunnerAttestation({ ...sources, image: undefined }));
  assert.throws(() =>
    buildRunnerAttestation({
      ...sources,
      policy: { ...sources.policy, canonical: `${sources.policy.canonical} ` },
    })
  );
  assert.throws(() =>
    buildRunnerAttestation({
      ...sources,
      service: { ...sources.service, sha256Receipt: `${'0'.repeat(64)}\n` },
    })
  );
});

test('refuses duplicate authority and a host-runtime shared-file mismatch', () => {
  const sources = validSources();
  const github = JSON.parse(sources.github.canonical);
  github.runner.authorityMode = 'duplicate';
  assert.throws(() =>
    buildRunnerAttestation({ ...sources, github: source('github', github) })
  );

  const runtime = JSON.parse(sources.runtime.canonical);
  runtime.runtimeRunner.files[0].sha256 = 'f'.repeat(64);
  runtime.runtimeRunnerBinaryDigest = hash(runtime.runtimeRunner);
  assert.throws(() =>
    buildRunnerAttestation({ ...sources, runtime: source('runtime', runtime) })
  );
});

test('refuses a nonminimal sealed runner identity and secret-shaped values', () => {
  const sources = validSources();
  const host = JSON.parse(sources.host.canonical);
  host.hostRunner.runner.serverUrl = 'https://github.com/ogabasseyy/Baci';
  host.hostRunnerIdentityDigest = hash(host.hostRunner.runner);
  assert.throws(() =>
    buildRunnerAttestation({ ...sources, host: source('host', host) })
  );
  const drifted = validSources();
  const driftedHost = JSON.parse(drifted.host.canonical);
  driftedHost.hostRunnerIdentityDigest = '0'.repeat(64);
  assert.throws(() =>
    buildRunnerAttestation({ ...drifted, host: source('host', driftedHost) })
  );
  const policy = JSON.parse(sources.policy.canonical);
  policy.apiToken = 'not-permitted';
  assert.throws(() =>
    buildRunnerAttestation({ ...sources, policy: source('policy', policy) })
  );
});

test('binds every frozen generation-one host field', () => {
  for (const field of contract.builderSources.host.frozenFields) {
    const sources = validSources();
    const host = JSON.parse(sources.host.canonical);
    host.hostIdentity[field] = drift(host.hostIdentity[field]);
    host.hostIdentityDigest = hash(host.hostIdentity);
    assert.throws(
      () => buildRunnerAttestation({ ...sources, host: source('host', host) }),
      /host runner identity mismatch/,
      field
    );
  }
});

test('binds runtime binary hashes to the reviewed generated image manifest', () => {
  for (const mutate of [
    (runtime) => {
      runtime.chrome.binarySha256 = '9'.repeat(64);
    },
    (runtime) => {
      runtime.node.binarySha256 = '9'.repeat(64);
    },
    (runtime) => {
      runtime.pnpm.binarySha256 = '9'.repeat(64);
    },
    (runtime) => {
      runtime.pnpm.packageJsonSha256 = '9'.repeat(64);
    },
  ]) {
    const sources = validSources();
    const runtime = JSON.parse(sources.runtime.canonical);
    mutate(runtime);
    assert.throws(() =>
      buildRunnerAttestation({
        ...sources,
        runtime: source('runtime', runtime),
      })
    );
  }
});

test('binds the resolved Chrome target to the reviewed runtime projection', () => {
  const sources = validSources();
  const runtime = JSON.parse(sources.runtime.canonical);
  runtime.chrome.targetPath = contract.builderSources.runtime.chrome.targetPath;
  assert.throws(() =>
    buildRunnerAttestation({ ...sources, runtime: source('runtime', runtime) })
  );
});

test('binds runtime evidence to the independently attested image', () => {
  const sources = validSources();
  const runtime = JSON.parse(sources.runtime.canonical);
  runtime.imageId = `sha256:${'f'.repeat(64)}`;
  assert.throws(
    () =>
      buildRunnerAttestation({
        ...sources,
        runtime: source('runtime', runtime),
      }),
    /runtime image mismatch/
  );
});

test('requires the frozen controller generation and exact ordered labels', () => {
  for (const mutate of [
    (runner) => runner.labels.pop(),
    (runner) => runner.labels.push('extra'),
    (runner) => runner.labels.push('Linux'),
    (runner) => runner.labels.splice(1, 1, 'x64'),
    (runner) => runner.labels.reverse(),
    (runner) => {
      runner.controllerGeneration = 2;
    },
  ]) {
    const sources = validSources();
    const github = JSON.parse(sources.github.canonical);
    mutate(github.runner);
    assert.throws(() =>
      buildRunnerAttestation({
        ...sources,
        github: source('github', github),
      })
    );
  }
});
test('rejects secret-shaped material in string values', () => {
  assert.throws(
    () => canonicalJson({ description: 'contains-credential-material' }),
    /secret-shaped string value/
  );
});
