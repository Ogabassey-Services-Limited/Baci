// biome-ignore-all format: compact end-to-end fixture stays below the 300-line limit
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { freezeSourceManifest } from './source-manifest.mjs';
import { authorizeTask9Bundle, BUNDLE_ENTRIES, canonicalJson, readBundleFiles } from './task9-bootstrap.mjs';
import { generateTask9BootstrapBundle } from './task9-bootstrap-bundle.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const cwd = fileURLToPath(new URL('../..', import.meta.url));
const git = (...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function frozenInputs() {
  const root = mkdtempSync(join(tmpdir(), 'task9-generator-input-'));
  chmodSync(root, 0o700);
  const reviewedSha = git('rev-parse', 'HEAD');
  const baseSha = git('rev-parse', 'HEAD^');
  const paths = {
    manifest: join(root, 'frozen-manifest.json'),
    manifestDigest: join(root, 'frozen-manifest.sha256'),
    sourceArchive: join(root, 'frozen-source.tar'),
    sourceArchiveDigest: join(root, 'frozen-source.sha256'),
  };
  freezeSourceManifest({
    baseSha,
    cwd,
    mergeSha: reviewedSha,
    output: paths.manifest,
    outputDigest: paths.manifestDigest,
    prNumber: 3297,
    reviewedHeadSha: reviewedSha,
    sourceArchive: paths.sourceArchive,
    sourceArchiveDigest: paths.sourceArchiveDigest,
  });
  const policy = JSON.parse(
    execFileSync('git', ['show', `${reviewedSha}:infra/cwv-runner/policy.json`], {
      cwd,
      encoding: 'utf8',
    })
  );
  const node = Buffer.from('authorized Darwin Node 24.18.0 fixture');
  const provenance = { archiveSha256: policy.supplyChain.node.ownerDarwinArm64Sha256,
    artifact: 'node',
    checksumSha256: policy.supplyChainProvenance.node.checksumsSha256,
    keyringSha256: policy.supplyChainProvenance.node.keyringSha256,
    schemaVersion: 1,
    sha256: hash(node), executableSha256: hash(node),
    signatureSha256: policy.supplyChainProvenance.node.signatureSha256,
    version: policy.supplyChain.node.version,
  };
  const nodePath = join(root, 'node');
  const nodeArchivePath = join(root, 'node.tar.xz');
  const nodeProvenance = join(root, 'node-provenance.json');
  const prMetadataPath = join(root, 'pr-metadata.json');
  const prMetadataDigestPath = join(root, 'pr-metadata.sha256');
  const prMetadata = Buffer.from(canonicalJson({
    baseSha,
    headRef: 'codex/h0-cwv-integration',
    number: 3297,
    reviewedHeadSha: reviewedSha,
  }));
  writeFileSync(prMetadataPath, prMetadata, { mode: 0o600 });
  writeFileSync(prMetadataDigestPath, `${hash(prMetadata)}\n`, { mode: 0o600 });
  writeFileSync(nodePath, node, { mode: 0o500 });
  writeFileSync(nodeArchivePath, 'test archive bytes', { mode: 0o400 });
  writeFileSync(nodeProvenance, canonicalJson(provenance), { mode: 0o400 });
  return { baseSha, nodeArchivePath, nodePath, nodeProvenance, paths, prMetadataDigestPath, prMetadataPath, reviewedSha, root };
}

function input(fixture, outputRoot) {
  return {
    admissionId: 'a'.repeat(64),
    bundleId: 'task9-bundle-deterministic',
    cwd,
    deploymentSha: fixture.reviewedSha,
    generation: 0,
    headRef: 'codex/h0-cwv-integration',
    nodeArchivePath: fixture.nodeArchivePath,
    nodePath: fixture.nodePath,
    nodeProvenancePath: fixture.nodeProvenance,
    outputRoot,
    prMetadataDigestPath: fixture.prMetadataDigestPath,
    prMetadataPath: fixture.prMetadataPath,
    sourceArchiveDigestPath: fixture.paths.sourceArchiveDigest,
    sourceArchivePath: fixture.paths.sourceArchive,
    sourceManifestDigestPath: fixture.paths.manifestDigest,
    sourceManifestPath: fixture.paths.manifest,
    transactionId: 'task9-transaction-deterministic',
    workflowId: 987654,
  };
}

const generate = (value, options = {}) =>
  generateTask9BootstrapBundle(value, {
    verifyNodeArchive: () => undefined,
    ...options,
  });

let baseline;
after(() => baseline && rmSync(baseline.root, { force: true, recursive: true }));
const getBaseline = () => (baseline ??= frozenInputs());

function clonedInputs() {
  const source = getBaseline();
  const root = mkdtempSync(join(tmpdir(), 'task9-generator-clone-'));
  chmodSync(root, 0o700);
  const paths = Object.fromEntries(
    Object.entries(source.paths).map(([name, sourcePath]) => {
      const target = join(root, name);
      cpSync(sourcePath, target);
      chmodSync(target, 0o600);
      return [name, target];
    })
  );
  const nodePath = join(root, 'node');
  const nodeArchivePath = join(root, 'node.tar.xz');
  const nodeProvenance = join(root, 'node-provenance.json');
  const prMetadataPath = join(root, 'pr-metadata.json');
  const prMetadataDigestPath = join(root, 'pr-metadata.sha256');
  cpSync(source.nodePath, nodePath);
  cpSync(source.nodeArchivePath, nodeArchivePath);
  cpSync(source.nodeProvenance, nodeProvenance);
  cpSync(source.prMetadataPath, prMetadataPath);
  cpSync(source.prMetadataDigestPath, prMetadataDigestPath);
  chmodSync(nodePath, 0o500);
  chmodSync(nodeArchivePath, 0o400);
  chmodSync(nodeProvenance, 0o400);
  return {
    baseSha: source.baseSha,
    nodeArchivePath,
    nodePath,
    nodeProvenance,
    paths,
    prMetadataDigestPath,
    prMetadataPath,
    reviewedSha: source.reviewedSha,
    root,
  };
}

test('generates the exact sealed bundle accepted by the real Task 9 authorizer', () => {
  const fixture = clonedInputs();
  const outputRoot = join(
    tmpdir(),
    'baci-cwv-task9-bootstrap-task9-transaction-deterministic'
  );
  rmSync(outputRoot, { force: true, recursive: true });
  try {
    const previousGitDir = Reflect.get(process.env, 'GIT_DIR');
    const previousGitWorkTree = Reflect.get(process.env, 'GIT_WORK_TREE');
    const previousPath = process.env.PATH;
    Reflect.set(process.env, 'GIT_DIR', join(fixture.root, 'attacker.git'));
    Reflect.set(process.env, 'GIT_WORK_TREE', fixture.root);
    process.env.PATH = fixture.root;
    let generated;
    try {
      generated = generate(input(fixture, outputRoot), { outputParent: tmpdir() });
    } finally {
      if (previousGitDir === undefined) Reflect.deleteProperty(process.env, 'GIT_DIR');
      else Reflect.set(process.env, 'GIT_DIR', previousGitDir);
      if (previousGitWorkTree === undefined) Reflect.deleteProperty(process.env, 'GIT_WORK_TREE');
      else Reflect.set(process.env, 'GIT_WORK_TREE', previousGitWorkTree);
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
    }
    const payload = join(outputRoot, 'payload');
    assert.deepEqual(readdirSync(payload).sort(), [...BUNDLE_ENTRIES].sort());
    for (const name of BUNDLE_ENTRIES)
      assert.equal(
        statSync(join(payload, name)).mode & 0o777,
        name === 'node' ? 0o500 : 0o400
      );
    assert.equal(
      readFileSync(join(payload, 'manifest.sha256'), 'utf8'),
      `${hash(readFileSync(join(payload, 'manifest.json')))}  manifest.json\n`
    );
    assert.equal(
      readFileSync(join(payload, 'source.tar.sha256'), 'utf8'),
      `${hash(readFileSync(join(payload, 'source.tar')))}  source.tar\n`
    );
    const envelopeBytes = readFileSync(generated.envelopePath);
    assert.equal(envelopeBytes.toString(), canonicalJson(JSON.parse(envelopeBytes)));
    const authorized = authorizeTask9Bundle({
      bundleId: generated.bundleId,
      envelopeBytes,
      envelopeSha256: generated.envelopeSha256,
      files: readBundleFiles(payload, process.getuid()),
      owner: process.getuid(),
      reviewedEnvelopeSha256: generated.envelopeSha256,
    });
    assert.equal(authorized.receipt.sourceBinding.deploymentSha, fixture.reviewedSha);
    assert.equal(authorized.receipt.transactionId, 'task9-transaction-deterministic');
  } finally {
    rmSync(outputRoot, { force: true, recursive: true });
    rmSync(fixture.root, { force: true, recursive: true });
  }
});
test('refuses drifted digests and invalid source archive entry shapes', () => {
  const fixture = clonedInputs();
  const outputRoot = join(
    tmpdir(),
    'baci-cwv-task9-bootstrap-task9-transaction-deterministic'
  );
  rmSync(outputRoot, { force: true, recursive: true });
  try {
    assert.throws(
      () => generate({ ...input(fixture, outputRoot), deploymentSha: 'f'.repeat(40) }, { outputParent: tmpdir() }),
      /source identity/
    );
    writeFileSync(fixture.paths.manifestDigest, `${'0'.repeat(64)}\n`);
    assert.throws(
      () => generate(input(fixture, outputRoot), { outputParent: tmpdir() }),
      /manifest|digest/
    );
    assert.throws(() => statSync(outputRoot), /ENOENT/);
    const manifest = JSON.parse(readFileSync(fixture.paths.manifest));
    manifest.sourceArchive.entries = {};
    const bytes = Buffer.from(canonicalJson(manifest));
    writeFileSync(fixture.paths.manifest, bytes);
    writeFileSync(fixture.paths.manifestDigest, `${hash(bytes)}\n`);
    assert.throws(
      () => generate(input(fixture, outputRoot), { outputParent: tmpdir() }),
      /invalid frozen manifest/
    );
  } finally {
    rmSync(outputRoot, { force: true, recursive: true });
    rmSync(fixture.root, { force: true, recursive: true });
  }
});
test('refuses Node provenance that is not the policy-signed identity', () => {
  const fixture = clonedInputs();
  const outputRoot = join(
    tmpdir(),
    'baci-cwv-task9-bootstrap-task9-transaction-deterministic'
  );
  rmSync(outputRoot, { force: true, recursive: true });
  try {
    const provenance = JSON.parse(readFileSync(fixture.nodeProvenance));
    provenance.archiveSha256 = '0'.repeat(64);
    chmodSync(fixture.nodeProvenance, 0o600);
    writeFileSync(fixture.nodeProvenance, canonicalJson(provenance));
    chmodSync(fixture.nodeProvenance, 0o400);
    assert.throws(
      () => generate(input(fixture, outputRoot), { outputParent: tmpdir() }),
      /Node provenance/
    );
    assert.throws(() => statSync(outputRoot), /ENOENT/);
  } finally {
    rmSync(outputRoot, { force: true, recursive: true });
    rmSync(fixture.root, { force: true, recursive: true });
  }
});
test('refuses a coordinated pathname swap between held reads and source verification', () => {
  const fixture = clonedInputs();
  const transactionId = 'task9-coordinated-swap';
  const outputRoot = join(tmpdir(), `baci-cwv-task9-bootstrap-${transactionId}`);
  rmSync(outputRoot, { force: true, recursive: true });
  try {
    const validManifest = readFileSync(fixture.paths.manifest);
    const validDigest = readFileSync(fixture.paths.manifestDigest);
    const changed = JSON.parse(validManifest);
    changed.entries = [
      ...changed.entries,
      { absent: true, path: 'attacker-selected', status: 'D' },
    ];
    const changedBytes = Buffer.from(canonicalJson(changed));
    writeFileSync(fixture.paths.manifest, changedBytes);
    writeFileSync(fixture.paths.manifestDigest, `${hash(changedBytes)}\n`);
    assert.throws(
      () =>
        generate(
          {
            ...input(fixture, outputRoot),
            transactionId,
          },
          {
            beforeVerify() {
              writeFileSync(fixture.paths.manifest, validManifest);
              writeFileSync(fixture.paths.manifestDigest, validDigest);
            },
            outputParent: tmpdir(),
          }
        ),
      /source changed during verification/
    );
    assert.throws(() => statSync(outputRoot), /ENOENT/);
  } finally {
    rmSync(outputRoot, { force: true, recursive: true });
    rmSync(fixture.root, { force: true, recursive: true });
  }
});
test('does not delete external output when exclusive mkdir loses a race', () => {
  const fixture = clonedInputs();
  const transactionId = 'task9-output-race';
  const outputRoot = join(tmpdir(), `baci-cwv-task9-bootstrap-${transactionId}`);
  const marker = join(outputRoot, 'external');
  rmSync(outputRoot, { force: true, recursive: true });
  try {
    assert.throws(() => generate(
      { ...input(fixture, outputRoot), transactionId },
      { outputParent: tmpdir(), makeOutputDirectory(path, options) {
        mkdirSync(path, options);
        writeFileSync(marker, 'external');
        throw new Error('external mkdir won');
      } }
    ), /external mkdir won/);
    assert.equal(readFileSync(marker, 'utf8'), 'external');
  } finally {
    rmSync(outputRoot, { force: true, recursive: true });
    rmSync(fixture.root, { force: true, recursive: true });
  }
});
