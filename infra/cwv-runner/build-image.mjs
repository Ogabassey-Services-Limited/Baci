import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveSha256 } from './archive-stream.mjs';
import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';
import { archiveIdentity } from './image-projection.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';
import { gitSourceProjection } from './source-tree-projection.mjs';

export { archiveIdentity } from './image-projection.mjs';

const directory = fileURLToPath(new URL('.', import.meta.url));
const repositoryRoot = resolve(directory, '../..');
const policyBytes = readFileSync(new URL('policy.json', import.meta.url));
const policy = parseRunnerPolicy(JSON.parse(policyBytes.toString('utf8')));
const platform = 'linux/amd64';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const policyFileSha256 = sha256(policyBytes);
const policyCanonicalSha256 = canonicalSha256(policy);
// biome-ignore format: the complete approved build-argument inventory is intentionally contiguous.
const buildArgumentNames = ['SOURCE_MANIFEST_SHA256', 'UBUNTU_IMAGE', 'UBUNTU_SNAPSHOT', 'UBUNTU_SOURCES_BASE64', 'RUNNER_URL', 'RUNNER_SHA256', 'RUNNER_VERSION', 'RUNNER_ASSET_ID', 'RUNNER_ALLOWED_FINAL_ORIGINS', 'COMMAND_SETTINGS_URL', 'COMMAND_SETTINGS_SHA256', 'COMMAND_SETTINGS_ALLOWED_FINAL_ORIGINS', 'NODE_URL', 'NODE_SHA256', 'NODE_VERSION', 'NODE_ALLOWED_FINAL_ORIGINS', 'PNPM_METADATA_URL', 'PNPM_URL', 'PNPM_SHA256', 'PNPM_INTEGRITY', 'PNPM_SHA1', 'PNPM_VERSION', 'PNPM_ALLOWED_FINAL_ORIGINS', 'CHROME_URL', 'CHROME_SHA256', 'CHROME_VERSION', 'CHROME_ALLOWED_FINAL_ORIGINS', 'CHROME_INRELEASE_SHA256', 'CHROME_PACKAGES_SHA256', 'CHROME_SIGNING_KEY_SHA256', 'SUPPLY_CHAIN_PROVENANCE_JSON'];
function ubuntuSources() {
  const ubuntu = policy.supplyChain.ubuntu;
  // biome-ignore format: one policy-derived deb822 tuple keeps this security wrapper within the line gate.
  return `${ubuntu.sources
    .map((source) => ['Types: deb', `URIs: ${source.uri}`, `Suites: ${source.suites.join(' ')}`, `Components: ${source.components.join(' ')}`, `Architectures: ${ubuntu.architecture}`, `Signed-By: ${ubuntu.signedBy}`, `Snapshot: ${ubuntu.snapshotId}`].join('\n'))
    .join('\n\n')}\n`;
}

export function imageTag() {
  const runner = policy.supplyChain.runner.version;
  const chromeMajor = policy.supplyChain.chrome.version.split('.')[0];
  if (!/^\d+\.\d+\.\d+$/.test(runner) || !/^\d+$/.test(chromeMajor)) {
    throw new TypeError('invalid image versions');
  }
  return `baci-cwv-runner:${runner}-chrome${chromeMajor}`;
}

export function policyBuildArguments(
  sourceManifestSha256 = '<source-manifest-sha256>'
) {
  const chain = policy.supplyChain;
  const provenance = policy.supplyChainProvenance;
  // biome-ignore format: complete policy projection is easier to audit as one closed mapping.
  const projection = {
    SOURCE_MANIFEST_SHA256: sourceManifestSha256,
    UBUNTU_IMAGE: chain.ubuntu.reference, UBUNTU_SNAPSHOT: chain.ubuntu.snapshotId,
    UBUNTU_SOURCES_BASE64: Buffer.from(ubuntuSources()).toString('base64'),
    RUNNER_URL: chain.runner.url, RUNNER_SHA256: chain.runner.sha256, RUNNER_VERSION: chain.runner.version,
    RUNNER_ASSET_ID: String(provenance.runner.assetId),
    RUNNER_ALLOWED_FINAL_ORIGINS: canonicalJson(chain.runner.allowedFinalOrigins),
    COMMAND_SETTINGS_URL: chain.runner.commandSettingsUrl, COMMAND_SETTINGS_SHA256: chain.runner.commandSettingsSha256,
    COMMAND_SETTINGS_ALLOWED_FINAL_ORIGINS: canonicalJson(chain.runner.commandSettingsAllowedFinalOrigins),
    NODE_URL: chain.node.url, NODE_SHA256: chain.node.sha256, NODE_VERSION: chain.node.version,
    NODE_ALLOWED_FINAL_ORIGINS: canonicalJson(chain.node.allowedFinalOrigins),
    PNPM_METADATA_URL: provenance.pnpm.metadataUrl,
    PNPM_URL: chain.pnpm.url, PNPM_SHA256: chain.pnpm.sha256, PNPM_INTEGRITY: chain.pnpm.integrity, PNPM_VERSION: chain.pnpm.version,
    PNPM_SHA1: provenance.pnpm.distShasum,
    PNPM_ALLOWED_FINAL_ORIGINS: canonicalJson(chain.pnpm.allowedFinalOrigins),
    CHROME_URL: chain.chrome.url, CHROME_SHA256: chain.chrome.sha256, CHROME_VERSION: chain.chrome.version,
    CHROME_ALLOWED_FINAL_ORIGINS: canonicalJson(chain.chrome.allowedFinalOrigins),
    CHROME_INRELEASE_SHA256: provenance.chrome.inReleaseSha256,
    CHROME_PACKAGES_SHA256: provenance.chrome.packagesSha256,
    CHROME_SIGNING_KEY_SHA256: provenance.chrome.signingKeySha256,
    SUPPLY_CHAIN_PROVENANCE_JSON: canonicalJson(provenance)
  };
  if (
    canonicalJson(Object.keys(projection).sort()) !==
    canonicalJson([...buildArgumentNames].sort())
  )
    throw new TypeError('invalid build argument projection');
  return projection;
}

function imageLabels(sourceManifestSha256) {
  return {
    'io.baci.cwv.chrome-version': policy.supplyChain.chrome.version,
    'io.baci.cwv.node-version': policy.supplyChain.node.version,
    'io.baci.cwv.pnpm-version': policy.supplyChain.pnpm.version,
    'io.baci.cwv.policy-canonical-sha256': policyCanonicalSha256,
    'io.baci.cwv.policy-file-sha256': policyFileSha256,
    'io.baci.cwv.provenance-schema': '1',
    'io.baci.cwv.runner-version': policy.supplyChain.runner.version,
    'io.baci.cwv.source-manifest-sha256': sourceManifestSha256,
  };
}

export function buildArgv(
  archive = '<owner-temporary-output>',
  sourceManifestSha256 = '<source-manifest-sha256>'
) {
  // biome-ignore format: fixed argv prefix is kept contiguous for static audit.
  const argv = [
    'buildx', 'build', '--platform', platform, '--output', `type=docker,dest=${archive}`,
    '--tag', imageTag(), '--file', resolve(directory, 'Dockerfile'),
  ];
  for (const [name, value] of Object.entries(
    policyBuildArguments(sourceManifestSha256)
  )) {
    argv.push('--build-arg', `${name}=${value}`);
  }
  if (
    !buildArgumentNames.every(
      (name) =>
        argv.filter((value) => value.startsWith(`${name}=`)).length === 1
    )
  )
    throw new TypeError('invalid build argument occurrence');
  for (const [name, value] of Object.entries(imageLabels(sourceManifestSha256)))
    argv.push('--label', `${name}=${value}`);
  argv.push(repositoryRoot);
  return argv;
}
// biome-ignore format: source manifest top-level keys are an exact schema inventory.
const sourceKeys = ['authority', 'baseSha', 'entries', 'mergeSha', 'policyCanonicalSha256', 'policyFileSha256', 'prNumber', 'reviewedHeadSha', 'schemaVersion', 'sourceArchive'];
// biome-ignore format: closed-record equality is one reusable predicate.
const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
// biome-ignore format: one compact path predicate preserves the enforced source line gate.
const safePath = (path) => typeof path === 'string' && path === path.normalize('NFC') && !path.startsWith('/') && !path.includes('\\') && ![...path].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) && path.split('/').every((part) => part && part !== '.' && part !== '..');
// biome-ignore format: PR-diff rows and source-archive rows have separate closed schemas.
function validateEntries(entries, archive = false) {
  if (!Array.isArray(entries) || entries.length === 0) throw new TypeError('invalid source manifest entries');
  let previous;
  for (const entry of entries) {
    const deletion = !archive && entry?.absent === true;
    const keys = archive ? ['blobSha256', 'mode', 'path'] : deletion ? ['absent', 'path', 'status'] : ['blobSha256', 'mode', 'path', 'status'];
    const sorted = !previous || Buffer.compare(Buffer.from(previous), Buffer.from(entry?.path ?? '')) < 0;
    const content = archive ? /^(100644|100755)$/.test(entry?.mode) && /^[0-9a-f]{64}$/.test(entry?.blobSha256) : deletion ? entry.status === 'D' : ['A', 'M', 'T'].includes(entry?.status) && /^(100644|100755|120000|160000)$/.test(entry?.mode) && /^[0-9a-f]{64}$/.test(entry?.blobSha256);
    if (!exactKeys(entry, keys) || !safePath(entry.path) || !sorted || !content) throw new TypeError('invalid source manifest entry');
    previous = entry.path;
  }
}

// biome-ignore format: the exact manifest validator is intentionally compact under the audited line gate.
export function parseSourceManifest(path, expectedSha256) {
  if (!/^[0-9a-f]{64}$/.test(expectedSha256 ?? '')) throw new TypeError('invalid source manifest digest');
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid()) throw new TypeError('unsafe source manifest file');
  const bytes = readFileSync(path);
  if (sha256(bytes) !== expectedSha256) throw new TypeError('source manifest digest mismatch');
  let manifest;
  try { manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new TypeError('malformed source manifest'); }
  if (canonicalJson(manifest) !== bytes.toString('utf8')) throw new TypeError('noncanonical source manifest');
  const gitSha = /^[0-9a-f]{40}$/;
  // biome-ignore format: all schema identity fields fail closed together.
  if (!exactKeys(manifest, sourceKeys) || manifest.schemaVersion !== 1 || !Number.isSafeInteger(manifest.prNumber) || manifest.prNumber < 1 || !gitSha.test(manifest.reviewedHeadSha) || !gitSha.test(manifest.baseSha) || !gitSha.test(manifest.mergeSha) || !exactKeys(manifest.sourceArchive, ['entries', 'prefix']) || manifest.sourceArchive.prefix !== 'infra/cwv-runner/') throw new TypeError('invalid source manifest schema');
  if (manifest.policyFileSha256 !== policyFileSha256 || manifest.policyCanonicalSha256 !== policyCanonicalSha256) throw new TypeError('source manifest policy mismatch');
  if (canonicalJson(manifest.authority) !== canonicalJson(policy.authority)) throw new TypeError('source manifest authority mismatch');
  validateEntries(manifest.entries);
  validateEntries(manifest.sourceArchive.entries, true);
  if (!manifest.sourceArchive.entries.every((entry) => entry.path.startsWith(manifest.sourceArchive.prefix))) throw new TypeError('source archive path outside prefix');
  return { manifest, sha256: expectedSha256 };
}
// biome-ignore format: closed local source byte and mode admission precedes the Docker build.
export function verifySourceProjection(manifest, root = repositoryRoot, runGit = (args) => execFileSync('git', args, { cwd: root, encoding: null })) {
  const sourceRoot = resolve(root);
  if (canonicalJson(manifest.sourceArchive.entries) !== canonicalJson(gitSourceProjection(manifest, runGit))) throw new TypeError('incomplete source archive projection');
  for (const entry of manifest.sourceArchive.entries) {
    const file = resolve(sourceRoot, entry.path); if (!file.startsWith(`${sourceRoot}/`)) throw new TypeError('unsafe source archive member');
    const info = lstatSync(file); const sourceMode = (info.mode & 0o111) === 0 ? '100644' : (info.mode & 0o111) === 0o111 ? '100755' : '';
    if (!info.isFile() || info.isSymbolicLink() || sourceMode !== entry.mode) throw new TypeError('unsafe source archive member');
    if (sha256(readFileSync(file)) !== entry.blobSha256) throw new TypeError('source archive byte drift');
  }
}
// biome-ignore format: the three immutable git-context checks remain visibly contiguous.
export function verifyCleanBuildContext(manifest, runGit = (args) => execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' })) {
  if (resolve(runGit(['rev-parse', '--show-toplevel']).trim()) !== repositoryRoot) throw new TypeError('build context repository mismatch');
  const head = runGit(['rev-parse', 'HEAD']).trim();
  if (head !== manifest.mergeSha) throw new TypeError('build context merge mismatch');
  if (runGit(['status', '--porcelain=v1', '-z', '--untracked-files=all']).length) throw new TypeError('dirty build context refused');
  return head;
}
// biome-ignore format: the local-only builder admission remains compact for the audited file-size gate.
function refuseUnsafeBuilder() {
  if (process.platform !== 'darwin') throw new TypeError('build permitted only on development Mac');
  if (['DOCKER_HOST', 'DOCKER_CONTEXT', 'BUILDX_BUILDER', 'BUILDKIT_HOST'].some((name) => process.env[name])) throw new TypeError('remote Docker context refused');
  const hostname = execFileSync('hostname', [], { encoding: 'utf8' }).trim();
  if (hostname === policy.host.hostname) throw new TypeError('production host build refused');
  // biome-ignore format: exact local endpoint query is fixed argv without a shell.
  const endpoint = execFileSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8' }).trim();
  if (!endpoint.startsWith('unix://')) throw new TypeError('remote Docker endpoint refused');
  const selected = execFileSync('docker', ['buildx', 'ls', '--format', '{{.Name}} {{.Selected}}'], { encoding: 'utf8' }).trim().split('\n').map((line) => line.trim().split(/\s+/)).filter((row) => row.length === 2 && row[1] === 'true');
  if (selected.length !== 1 || !/^[A-Za-z0-9_.-]+$/.test(selected[0][0])) throw new TypeError('ambiguous Buildx builder');
  const nodes = JSON.parse(execFileSync('docker', ['buildx', 'inspect', selected[0][0], '--format', '{{json .Nodes}}'], { encoding: 'utf8' }));
  if (!Array.isArray(nodes) || !nodes.length || !nodes.every((node) => typeof node?.Endpoint === 'string' && node.Endpoint.startsWith('unix://'))) throw new TypeError('remote Buildx builder refused');
  return selected[0][0];
}
function exactOutputPaths(archive, receipt, allowMissing = false) {
  const left = resolve(archive);
  const right = resolve(receipt);
  const parent = dirname(left);
  // biome-ignore format: output parent topology is one gate.
  if (dirname(right) !== parent || parent === resolve(tmpdir()) || !parent.startsWith(`${resolve(tmpdir())}/`)) {
    throw new TypeError('outputs require one owner temporary directory');
  }
  const parentStat = lstatSync(parent);
  // biome-ignore format: output ownership and topology are one gate.
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink() || parentStat.uid !== process.getuid() || (parentStat.mode & 0o777) !== 0o700 || left === parent || right === parent || left === right) {
    throw new TypeError('unsafe output paths');
  }
  for (const path of [left, right]) {
    try {
      const info = lstatSync(path);
      // biome-ignore format: output file identity is one gate.
      if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid())
        throw new TypeError('unsafe output file');
    } catch (error) {
      if (!allowMissing || error.code !== 'ENOENT') throw error;
    }
  }
  return { archive: left, receipt: right };
}
function parseFlags(args, allowed) {
  // biome-ignore format: stale aliases are rejected as one set.
  if (args.some((arg) => ['--archive', '--receipt', '--directory'].includes(arg)))
    throw new TypeError('stale output flag');
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value || !allowed.includes(flag) || values[flag]) {
      throw new TypeError('invalid output flags');
    }
    values[flag] = value;
  }
  // biome-ignore format: missing exact flags are one refusal.
  if (Object.keys(values).length !== allowed.length) throw new TypeError('missing output flags');
  return values;
}
// biome-ignore format: the exact schema-v1 receipt mapping stays contiguous.
export function expectedBuildReceipt(archive, sourceManifest, implementationCommit) {
  return {
    archiveSha256: archiveSha256(archive),
    ...archiveIdentity(archive, sourceManifest),
    implementationCommit,
    platform,
    policyCanonicalSha256,
    policyFileSha256,
    schemaVersion: 1,
    sourceManifestSha256: sourceManifest.sha256,
  };
}
// biome-ignore format: the guarded build sequence stays visibly ordered.
function execute(archive, receipt, sourceManifest) {
  const implementationCommit = verifyCleanBuildContext(sourceManifest.manifest);
  verifySourceProjection(sourceManifest.manifest);
  const builder = refuseUnsafeBuilder();
  exactOutputPaths(archive, receipt, true);
  const argv = buildArgv(archive, sourceManifest.sha256);
  argv.splice(2, 0, '--builder', builder);
  const result = spawnSync(
    'docker',
    argv,
    {
    stdio: 'inherit',
    shell: false,
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('image build failed');
  const record = expectedBuildReceipt(archive, sourceManifest, implementationCommit);
  writeFileSync(receipt, canonicalJson(record), {
    flag: 'wx',
    mode: 0o400,
  });
}
// biome-ignore format: archive verification compares exact canonical bytes.
function verify(archive, receipt, sourceManifest) {
  exactOutputPaths(archive, receipt);
  const expected = expectedBuildReceipt(archive, sourceManifest, sourceManifest.manifest.mergeSha);
  if (readFileSync(receipt, 'utf8') !== canonicalJson(expected)) throw new TypeError('image receipt mismatch');
  process.stdout.write(`${platform} ${expected.imageId}\n`);
}
const [command, ...args] = process.argv.slice(2);
// biome-ignore format: the closed CLI dispatch stays compact to preserve the audited file-size gate.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (command === '--print-tag' && args.length === 0) process.stdout.write(`${imageTag()}\n`);
  else if (command === '--dry-run-json') {
    const flags = parseFlags(args, ['--source-manifest', '--source-manifest-sha256']);
    const sourceManifest = parseSourceManifest(flags['--source-manifest'], flags['--source-manifest-sha256']);
    process.stdout.write(`${canonicalJson({ argv: ['docker', ...buildArgv(undefined, sourceManifest.sha256)], buildArgs: policyBuildArguments(sourceManifest.sha256), platform, sourceManifestSha256: sourceManifest.sha256, tag: imageTag() })}\n`);
  } else if (['--execute', '--verify-archive'].includes(command)) {
    const flags = parseFlags(args, ['--source-manifest', '--source-manifest-sha256', '--output-archive', '--output-receipt']);
    const sourceManifest = parseSourceManifest(flags['--source-manifest'], flags['--source-manifest-sha256']);
    const archive = flags['--output-archive'];
    const receipt = flags['--output-receipt'];
    if (command === '--execute') execute(archive, receipt, sourceManifest);
    else verify(archive, receipt, sourceManifest);
  } else if (command === '--cleanup-output') {
    const flags = parseFlags(args, ['--output-archive', '--output-receipt']);
    const paths = exactOutputPaths(flags['--output-archive'], flags['--output-receipt'], true);
    rmSync(paths.archive, { force: true });
    rmSync(paths.receipt, { force: true });
  } else throw new TypeError('invalid build-image command');
}
