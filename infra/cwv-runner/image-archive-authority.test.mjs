import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { archiveLimits } from './archive-stream.mjs';
import { canonicalJson } from './canonical-json.mjs';
import { configureImageArchiveAuthority } from './image-archive-authority.mjs';
import { sealedPaths } from './image-process-map.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';

const policy = parseRunnerPolicy(
  JSON.parse(readFileSync(new URL('policy.json', import.meta.url), 'utf8'))
);

function rawTarHeader(name) {
  const header = Buffer.alloc(512);
  header.write(name);
  header.write('0000644\0', 100);
  header.write('00000000000\0', 124);
  header[156] = '0'.charCodeAt(0);
  header.fill(32, 148, 156);
  const checksum = header.reduce((sum, value) => sum + value, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'latin1');
  return header;
}
function rawLayer(...names) {
  const directory = mkdtempSync(join(tmpdir(), 'cwv-archive-authority-'));
  const layer = join(directory, 'layer.tar');
  writeFileSync(
    layer,
    Buffer.concat([...names.map(rawTarHeader), Buffer.alloc(1024)])
  );
  return { directory, layer };
}

const record = (path) => ({
  gid: 0,
  mode: '0555',
  path,
  sha256: 'a'.repeat(64),
  type: '0',
  uid: 0,
});
const member = (path) => ({
  mode: '0555',
  owner: '0:0',
  path,
  realpath: path,
  sha256: 'a'.repeat(64),
});
const map = () => ({
  entries: Object.entries(policy.processAllowSet.executables).map(
    ([role, rule]) => ({
      role,
      ...member(rule.path),
      maxInstancesByPhase: rule.maxInstancesByPhase,
    })
  ),
  phases: policy.processAllowSet.phases,
  receiptBinding: 'image-process-map-v1',
  schemaVersion: 1,
  sealed: [
    ...new Set([
      ...sealedPaths,
      ...Object.values(policy.processAllowSet.executables).map(
        ({ path }) => path
      ),
    ]),
  ]
    .sort()
    .map(member),
});

test('binds process receipt rows to archive headers', () => {
  const authority = configureImageArchiveAuthority({ recordFor: record });
  const receipt = map();
  assert.deepEqual(
    authority.validateProcessMap(Buffer.from(canonicalJson(receipt)), policy),
    receipt
  );
  assert.throws(
    () =>
      configureImageArchiveAuthority({
        recordFor: (path) => ({ ...record(path), mode: '0777' }),
      }).validateProcessMap(Buffer.from(canonicalJson(receipt)), policy),
    /process map header drift/
  );
});

test('collects archive rows for every claimed rootfs projection entry', () => {
  const projection = new Map([
    ['usr/bin/git', { kind: 'package', path: 'usr/bin/git' }],
    ['etc/passwd', { kind: 'generated', path: 'etc/passwd' }],
  ]);
  const rows = configureImageArchiveAuthority({ recordFor: record }).rootfsRows(
    projection
  );
  assert.deepEqual(
    [...rows],
    [
      ['usr/bin/git', record('usr/bin/git')],
      ['etc/passwd', record('etc/passwd')],
    ]
  );
});

test('refuses an incomplete runtime source manifest before layer access', () => {
  for (const error of [
    new TypeError('missing sealed runtime member'),
    new TypeError('unsafe provenance member'),
  ])
    assert.throws(
      () =>
        configureImageArchiveAuthority({
          exactLayerMember() {
            throw error;
          },
          layers: [],
          workspace: '',
        }).validateSourceProjection({
          sourceArchive: {
            entries: [
              {
                blobSha256: 'a'.repeat(64),
                mode: '100644',
                path: 'infra/cwv-runner/policy.json',
              },
            ],
          },
        }),
      /runtime source manifest membership refused/
    );
});

test('requires every authority source exactly once in the source manifest', () => {
  const authoritySources = [
    'cwv-runner-authority.mjs',
    'cwv-runner-authority-core.mjs',
    'cwv-runner-authority-runtime.mjs',
    'cwv-runner-stable-attestation-builder.mjs',
  ];
  const runtimeSources = [
    'canonical-json.mjs',
    'command-settings-contract.mjs',
    'container-attest-runtime.mjs',
    ...authoritySources,
    'direct-listener-conformance.mjs',
    'entrypoint-runtime.mjs',
    'entrypoint.mjs',
    'entrypoint.sh',
    'isolation-probe.sh',
    'normal-release.mjs',
    'policy.json',
    'policy.schema.mjs',
    'process-inventory.mjs',
    'registration-egress-probe.mjs',
    'registration-release.mjs',
    'runner-identity-gate.mjs',
    'sealed-runner.mjs',
  ];
  const entry = (name) => ({
    blobSha256: 'a'.repeat(64),
    mode: '100644',
    path: `infra/cwv-runner/${name}`,
  });
  for (const omitted of authoritySources) {
    const source = runtimeSources.filter((name) => name !== omitted).map(entry);
    assert.throws(
      () =>
        configureImageArchiveAuthority({
          exactLayerMember() {
            throw new Error('membership must be checked before layer access');
          },
          layers: [],
          workspace: '',
        }).validateSourceProjection({ sourceArchive: { entries: source } }),
      /runtime source manifest membership refused/
    );
  }
  assert.throws(
    () =>
      configureImageArchiveAuthority({
        exactLayerMember() {
          throw new Error('membership must be checked before layer access');
        },
        layers: [],
        workspace: '',
      }).validateSourceProjection({
        sourceArchive: {
          entries: [...runtimeSources.map(entry), entry(authoritySources[0])],
        },
      }),
    /runtime source manifest membership refused/
  );
});

test('refuses absent or non-array runtime source manifest rows', () => {
  const authority = configureImageArchiveAuthority({
    exactLayerMember() {
      throw new Error('source manifest must fail before layer access');
    },
    layers: [],
    workspace: '',
  });
  for (const source of [
    undefined,
    {},
    { sourceArchive: {} },
    { sourceArchive: { entries: {} } },
    { manifest: { sourceArchive: { entries: 'not-an-array' } } },
  ])
    assert.throws(
      () => authority.validateSourceProjection(source),
      /runtime source manifest refused/
    );
});

test('authorizes a realistic runtime layer above the outer member cap', () => {
  const target = 'usr/bin/git';
  const fillers = Array.from(
    { length: archiveLimits.members },
    (_value, index) => `usr/share/doc/git/cwv-layer-${index}`
  );
  const { directory, layer } = rawLayer(...fillers, target);
  const source = join(directory, 'source');
  writeFileSync(source, 'source');
  const rows = configureImageArchiveAuthority({
    exactLayerMember() {
      return source;
    },
    layers: [layer],
    workspace: directory,
  }).rootfsRows(new Map([[target, { path: target }]]));
  assert.equal(
    rows.get(target).sha256,
    '41cf6794ba4200b839c53531555f0f3998df4cbb01a4d5cb0b94e3ca5e23947d'
  );
});
