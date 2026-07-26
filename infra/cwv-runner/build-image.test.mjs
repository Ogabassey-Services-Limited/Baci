import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
// biome-ignore format: compact fixture imports preserve the enforced test-file line gate.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
// biome-ignore format: compact subject imports preserve the enforced test-file line gate.
import { archiveIdentity, expectedBuildReceipt, verifyCleanBuildContext, verifySourceProjection } from './build-image.mjs';
import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';
import { archiveFixture as projectionArchiveFixture } from './image-projection.fixture.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';
import { sourceArchiveFixturePaths } from './source-manifest.fixture.mjs';

// biome-ignore format: compact fixture constants preserve the enforced test-file line gate.
const [root, policy, buildScript, rawPolicySha256] = ((fixtureRoot, bytes) => [fixtureRoot, parseRunnerPolicy(JSON.parse(bytes.toString('utf8'))), fileURLToPath(new URL('build-image.mjs', fixtureRoot)), createHash('sha256').update(bytes).digest('hex')])(new URL('.', import.meta.url), readFileSync(new URL('policy.json', import.meta.url)));
function sourceManifest(overrides = {}) {
  // biome-ignore format: compact canonical fixture preserves room for archive tamper cases.
  return {
    authority: policy.authority, baseSha: '2'.repeat(40),
    entries: [{ blobSha256: '4'.repeat(64), mode: '100644', path: 'docs/cwv.md', status: 'M' }],
    mergeSha: '3'.repeat(40), policyCanonicalSha256: canonicalSha256(policy), policyFileSha256: rawPolicySha256, prNumber: 3131,
    reviewedHeadSha: '1'.repeat(40), schemaVersion: 1,
    sourceArchive: { entries: sourceArchiveFixturePaths.map((path) => ({ blobSha256: path.endsWith('/policy.json') ? rawPolicySha256 : digest('sealed'), mode: '100644', path })), prefix: 'infra/cwv-runner/' }, ...overrides
  };
}
function manifestFixture(
  value = sourceManifest(),
  bytes = canonicalJson(value)
) {
  const directory = mkdtempSync(join(tmpdir(), 'cwv-source-manifest-'));
  const path = join(directory, 'source-manifest.json');
  writeFileSync(path, bytes);
  return { digest: createHash('sha256').update(bytes).digest('hex'), path };
}
// biome-ignore format: compact CLI fixture preserves the enforced test-file line gate.
function invoke(command, fixture, extra = []) { const args = [buildScript, command]; if (fixture) args.push('--source-manifest', fixture.path, '--source-manifest-sha256', fixture.digest); return spawnSync(process.execPath, [...args, ...extra], { encoding: 'utf8' }); }
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const archiveFixture = (sourceSha, variant = 'valid') => {
  const { archive, directory: dir } = projectionArchiveFixture(
    variant,
    sourceSha
  );
  return { archive, dir };
};
test('derives the image tag and every build argument from policy', () => {
  const fixture = manifestFixture();
  const processResult = invoke('--dry-run-json', fixture);
  assert.equal(processResult.status, 0);
  const result = JSON.parse(processResult.stdout);
  assert.equal(result.tag, 'baci-cwv-runner:2.335.1-chrome150');
  assert.equal(result.platform, 'linux/amd64');
  assert.deepEqual(result.argv.slice(0, 6), [
    'docker',
    'buildx',
    'build',
    '--platform',
    'linux/amd64',
    '--output',
  ]);
  assert.ok(result.argv.includes('--file'));
  // biome-ignore format: the resolved build context assertion preserves the enforced test-file line gate.
  assert.equal(result.argv.at(-1), realpathSync(fileURLToPath(new URL('../..', root))));
  assert.equal(
    result.buildArgs.UBUNTU_IMAGE,
    policy.supplyChain.ubuntu.reference
  );
  assert.equal(result.buildArgs.RUNNER_URL, policy.supplyChain.runner.url);
  assert.equal(result.buildArgs.NODE_URL, policy.supplyChain.node.url);
  assert.equal(result.buildArgs.PNPM_URL, policy.supplyChain.pnpm.url);
  assert.equal(result.buildArgs.CHROME_URL, policy.supplyChain.chrome.url);
  assert.ok(result.argv.includes(`SOURCE_MANIFEST_SHA256=${fixture.digest}`));
  const source = Buffer.from(
    result.buildArgs.UBUNTU_SOURCES_BASE64,
    'base64'
  ).toString('utf8');
  // biome-ignore format: exact deb822 fixture is kept as one auditable tuple.
  assert.equal(
    source,
    `${policy.supplyChain.ubuntu.sources
      .map((item) => ['Types: deb', `URIs: ${item.uri}`, `Suites: ${item.suites.join(' ')}`, `Components: ${item.components.join(' ')}`, 'Architectures: amd64', `Signed-By: ${policy.supplyChain.ubuntu.signedBy}`, `Snapshot: ${policy.supplyChain.ubuntu.snapshotId}`].join('\n'))
      .join('\n\n')}\n`
  );
  assert.deepEqual(
    JSON.parse(result.buildArgs.SUPPLY_CHAIN_PROVENANCE_JSON),
    policy.supplyChainProvenance
  );
  assert.equal(Object.keys(result.buildArgs).length, 31);
  assert.equal(result.sourceManifestSha256, fixture.digest);
});
test('dry run requires a canonical schema-v1 source manifest', () => {
  const missing = spawnSync(process.execPath, [buildScript, '--dry-run-json'], {
    encoding: 'utf8',
  });
  assert.notEqual(missing.status, 0);
  const missingField = sourceManifest();
  delete missingField.mergeSha;
  for (const fixture of [
    manifestFixture({}, '{'),
    manifestFixture(
      sourceManifest(),
      JSON.stringify(sourceManifest(), null, 2)
    ),
    manifestFixture(missingField),
    manifestFixture({ ...sourceManifest(), entries: [] }),
  ]) {
    const result = invoke('--dry-run-json', fixture);
    assert.notEqual(result.status, 0);
  }
});
test('dry run refuses digest, policy, and authority drift', () => {
  const wrongDigest = manifestFixture();
  wrongDigest.digest = '0'.repeat(64);
  assert.notEqual(invoke('--dry-run-json', wrongDigest).status, 0);
  // biome-ignore format: the two independent policy digests share one refusal contract.
  for (const field of ['policyFileSha256', 'policyCanonicalSha256']) assert.notEqual(invoke('--dry-run-json', manifestFixture(sourceManifest({ [field]: '0'.repeat(64) }))).status, 0);
  const wrongAuthority = manifestFixture(
    sourceManifest({
      authority: { ...policy.authority, deploymentRunAttempt: 9 },
    })
  );
  assert.notEqual(invoke('--dry-run-json', wrongAuthority).status, 0);
});
test('source archive is a separate closed sorted regular-blob projection', () => {
  const validOutside = manifestFixture();
  assert.equal(invoke('--dry-run-json', validOutside).status, 0);
  // biome-ignore format: the closed malformed-projection matrix preserves the enforced line gate.
  for (const sourceArchive of [
    { entries: sourceManifest().sourceArchive.entries, prefix: 'docs/' },
    { entries: [...sourceManifest().sourceArchive.entries].reverse(), prefix: 'infra/cwv-runner/' },
    { entries: [{ ...sourceManifest().sourceArchive.entries[0], status: 'M' }], prefix: 'infra/cwv-runner/' },
    { entries: [{ blobSha256: '5'.repeat(64), mode: '120000', path: 'infra/cwv-runner/link' }], prefix: 'infra/cwv-runner/' },
  ]) assert.notEqual(invoke('--dry-run-json', manifestFixture(sourceManifest({ sourceArchive }))).status, 0);
});
test('source archive projection cannot be mutated by a caller', () => {
  assert.equal(Object.isFrozen(sourceArchiveFixturePaths), true);
});
// biome-ignore format: canonical local source fixture exercises exact mode and byte refusal.
test('source archive rows bind build inputs to their reviewed bytes and modes', () => {
  const root = mkdtempSync(join(tmpdir(), 'cwv-reviewed-source-'));
  const manifest = sourceManifest();
  for (const entry of manifest.sourceArchive.entries) {
    const path = join(root, entry.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, entry.path.endsWith('/policy.json') ? readFileSync(new URL('policy.json', import.meta.url)) : 'sealed');
  }
  const objectId = (entry) => (entry.path.endsWith('/policy.json') ? 'b' : 'a').repeat(40);
  const tree = Buffer.from(manifest.sourceArchive.entries.map((entry) => `${entry.mode} blob ${objectId(entry)}\t${entry.path}\0`).join(''));
  const runGit = (args) => args[0] === 'cat-file' ? args[2][0] === 'b' ? readFileSync(new URL('policy.json', import.meta.url)) : Buffer.from('sealed') : tree;
  assert.doesNotThrow(() => verifySourceProjection(manifest, root, runGit));
  for (const omitted of ['build-image.mjs', 'canonical-json.mjs'])
    assert.throws(() => verifySourceProjection({ ...manifest, sourceArchive: { ...manifest.sourceArchive, entries: manifest.sourceArchive.entries.filter(({ path }) => !path.endsWith(`/${omitted}`)) } }, root, runGit), /incomplete source archive projection/);
  const buildSource = join(root, 'infra/cwv-runner/build-image.mjs');
  chmodSync(buildSource, 0o755);
  assert.throws(() => verifySourceProjection(manifest, root, runGit), /unsafe source archive member/);
  chmodSync(buildSource, 0o644);
  writeFileSync(buildSource, 'drift');
  assert.throws(() => verifySourceProjection(manifest, root, runGit), /source archive byte drift/);
});
test('execute and archive verification require the manifest binding', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cwv-build-output-'));
  const outputs = [
    '--output-archive',
    join(directory, 'image.tar'),
    '--output-receipt',
    join(directory, 'receipt.json'),
  ];
  for (const command of ['--execute', '--verify-archive']) {
    const result = invoke(command, undefined, outputs);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing output flags/);
  }
});
test('execute refuses a fixture merge before Docker can run', () => {
  const source = manifestFixture();
  const directory = mkdtempSync(join(tmpdir(), 'cwv-build-merge-'));
  const archive = join(directory, 'image.tar');
  const result = invoke('--execute', source, [
    '--output-archive',
    archive,
    '--output-receipt',
    join(directory, 'receipt.json'),
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /build context merge mismatch/);
  assert.throws(() => readFileSync(archive));
});
test('clean build context requires the exact merge and an empty filesystem view', () => {
  const mergeSha = '3'.repeat(40);
  const repo = fileURLToPath(new URL('../..', root));
  const runGit = (args) => {
    if (args.includes('--show-toplevel')) return `${repo}\n`;
    if (args.includes('HEAD')) return `${mergeSha}\n`;
    return args.includes('--untracked-files=all') ? '?? unsafe\0' : '';
  };
  assert.throws(
    () => verifyCleanBuildContext({ mergeSha }, runGit),
    /dirty build context refused/
  );
});
// biome-ignore format: the archive happy path and exact-byte tamper remain one compact contract test.
test('archive identity binds config, platform, provenance, and the exact receipt', () => {
  const source = manifestFixture(); const fixture = archiveFixture(source.digest);
  const identity = archiveIdentity(fixture.archive, source.digest);
  assert.equal(identity.imageId, identity.configDigest);
  assert.deepEqual(Object.keys(identity.provenance), ['baseTools', 'chrome', 'node', 'ownerCli', 'pnpm', 'runner', 'ubuntu']);
  const bound = { manifest: sourceManifest(), sha256: source.digest };
  const expected = expectedBuildReceipt(fixture.archive, bound, bound.manifest.mergeSha);
  assert.equal(expected.policyFileSha256, rawPolicySha256);
  assert.equal(expected.policyCanonicalSha256, canonicalSha256(policy));
  assert.equal('policySha256' in expected, false);
  const receipt = join(fixture.dir, 'receipt.json');
  writeFileSync(receipt, canonicalJson(expected), { mode: 0o400 });
  const flags = ['--output-archive', fixture.archive, '--output-receipt', receipt];
  assert.equal(invoke('--verify-archive', source, flags).status, 0);
  chmodSync(receipt, 0o600);
  writeFileSync(receipt, canonicalJson({ ...expected, extra: true }));
  assert.match(invoke('--verify-archive', source, flags).stderr, /image receipt mismatch/);
});
test('archive receipt refuses a source-manifest runtime member omitted from the image', () => {
  const manifest = sourceManifest();
  const bound = { manifest, sha256: 'a'.repeat(64) };
  const { archive } = archiveFixture(bound.sha256, 'missing-sealed');
  assert.throws(
    () => expectedBuildReceipt(archive, bound, manifest.mergeSha),
    /missing sealed runtime member/
  );
});
// biome-ignore format: the complete archive tamper matrix stays visibly closed.
test('archive identity refuses provenance and config tampering', () => {
  const sourceSha = 'a'.repeat(64);
  for (const variant of ['bad-base-binding', 'fake-runner-identity', 'missing-sealed', 'extra-env', 'extra-history', 'secret-env']) {
    const { archive } = archiveFixture(sourceSha, variant);
    assert.throws(() => archiveIdentity(archive, sourceSha));
  }
});
// biome-ignore format: the Docker projection order and argument inventory stay contiguous.
test('Dockerfile consumes generic frozen arguments without literals', () => {
  const dockerfile = readFileSync(new URL('Dockerfile', root), 'utf8');
  const buildSource = readFileSync(buildScript, 'utf8'); const execution = buildSource.slice(buildSource.indexOf('function execute('), buildSource.indexOf('function verify('));
  assert.equal([...execution.matchAll(/buildArgv\(/g)].length, 1);
  assert.match(execution, /if \(result\.error\) throw result\.error;[\s\S]*if \(result\.status/);
  assert.ok(dockerfile.indexOf('dpkg-query -W') < dockerfile.indexOf('rm -rf /etc/apt'));
  assert.match(dockerfile, /^ARG UBUNTU_IMAGE$/m);
  assert.match(dockerfile, /^FROM \$\{UBUNTU_IMAGE\} AS verifier$/m);
  // biome-ignore format: exact Docker argument inventory stays contiguous.
  for (const name of ['SOURCE_MANIFEST_SHA256', 'UBUNTU_SNAPSHOT', 'UBUNTU_SOURCES_BASE64', 'RUNNER_URL', 'RUNNER_SHA256', 'RUNNER_ALLOWED_FINAL_ORIGINS', 'NODE_URL', 'NODE_SHA256', 'NODE_ALLOWED_FINAL_ORIGINS', 'PNPM_URL', 'PNPM_SHA256', 'PNPM_INTEGRITY', 'PNPM_ALLOWED_FINAL_ORIGINS', 'CHROME_URL', 'CHROME_SHA256', 'CHROME_ALLOWED_FINAL_ORIGINS', 'SUPPLY_CHAIN_PROVENANCE_JSON'])
    assert.match(dockerfile, new RegExp(`^ARG ${name}$`, 'm'));
  assert.doesNotMatch(dockerfile, /https:\/\/|4ef2f25285f0|55aa7153f9d8|deafa7ec98a1|83ed59c85878/);
  assert.doesNotMatch(dockerfile, /:latest|stable_current/);
  assert.doesNotMatch(dockerfile, /curl .*https:|wget|\$\{item\^\^\}/);
  const bootstrap = dockerfile.indexOf('/verify-node-bootstrap.sh');
  const extractNode = dockerfile.indexOf('tar -xJf');
  const provenance = dockerfile.indexOf('/supply-chain-provenance.mjs', extractNode);
  const extractRunner = dockerfile.indexOf('tar -xzf "$work/runner.artifact"');
  assert.ok(bootstrap > 0 && bootstrap < extractNode);
  assert.ok(provenance > extractNode && provenance < extractRunner);
});
// biome-ignore format: the exact cleanup scope and stale-flag refusal stay one compact test.
test('cleanup removes only exact output files in one owner temporary directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-image-'));
  const archive = join(dir, 'image.tar');
  const receipt = join(dir, 'receipt.json');
  const other = join(dir, 'keep');
  writeFileSync(archive, 'image');
  writeFileSync(receipt, '{}');
  writeFileSync(other, 'keep');
  assert.equal(invoke('--cleanup-output', undefined, ['--output-archive', archive, '--output-receipt', receipt]).status, 0);
  assert.equal(readFileSync(other, 'utf8'), 'keep');
  const stale = invoke('--cleanup-output', undefined, ['--archive', archive, '--output-receipt', receipt]);
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /stale output flag/);
});
// biome-ignore format: all unsafe cleanup topologies stay one compact refusal matrix.
test('cleanup refuses symlink, mixed-parent, and recursive targets', () => {
  const left = mkdtempSync(join(tmpdir(), 'cwv-clean-left-')); const right = mkdtempSync(join(tmpdir(), 'cwv-clean-right-'));
  const target = join(left, 'target'); writeFileSync(target, 'keep');
  const link = join(left, 'image.tar'); symlinkSync(target, link);
  const receipt = join(left, 'receipt.json'); writeFileSync(receipt, '{}');
  const recursive = join(left, 'directory'); mkdirSync(recursive);
  for (const [archive, record] of [[link, receipt], [target, join(right, 'receipt.json')], [recursive, receipt]]) assert.notEqual(invoke('--cleanup-output', undefined, ['--output-archive', archive, '--output-receipt', record]).status, 0);
  assert.equal(readFileSync(target, 'utf8'), 'keep');
});
