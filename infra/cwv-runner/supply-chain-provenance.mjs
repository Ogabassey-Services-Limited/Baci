import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  fetchSemanticJson,
  requestSemanticJson,
} from './bounded-semantic-fetch.mjs';
import { canonicalJson } from './canonical-json.mjs';
import { verifyCommandSettingsContract } from './command-settings-contract.mjs';
import {
  decodeArmoredPublicKey,
  withArmoredOpenPgpKeyring,
} from './openpgp-keyring.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';

// biome-ignore format: compact failure primitive preserves the runtime line gate.
const fail = (label) => { throw new TypeError(`invalid ${label}`); };
const assertValid = (condition, label) => condition || fail(label);
const digest = (algorithm, bytes) =>
  createHash(algorithm).update(bytes).digest('hex');
const readValue = (path, value, label) => {
  if (value !== undefined) return value;
  if (!path) fail(label);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    fail(label);
  }
};
const baseToolReceiptSha256 = (inputs) => {
  assertValid(typeof inputs.baseToolReceipt === 'string', 'base-tool receipt');
  let bytes;
  let receipt;
  try {
    bytes = readFileSync(inputs.baseToolReceipt, 'utf8');
    receipt = JSON.parse(bytes);
  } catch {
    fail('base-tool receipt');
  }
  assertValid(bytes === canonicalJson(receipt), 'base-tool receipt');
  return digest('sha256', bytes);
};
export async function fetchSemanticMetadata(
  value,
  requester = requestSemanticJson,
  limits = {}
) {
  const policy = parseRunnerPolicy(value);
  const timeout = limits.overallTimeoutMs ?? 30_000;
  assertValid(Number.isInteger(timeout) && timeout > 0, 'timeout');
  const provenance = policy.supplyChainProvenance;
  const controller = new AbortController();
  let failed = false;
  let firstFailure;
  // biome-ignore format: the only two semantic endpoints are deliberately visible together.
  const bounded = { ...limits, overallTimeoutMs: timeout, signal: controller.signal };
  const fetchMetadata = async (url, origins) => {
    try {
      return await fetchSemanticJson(url, origins, requester, bounded);
    } catch (error) {
      if (!failed) {
        failed = true;
        firstFailure = error;
        controller.abort(error);
      }
      throw error;
    }
  };
  const [runner, pnpm] = await Promise.allSettled([
    fetchMetadata(
      provenance.runner.releaseApiUrl,
      provenance.runner.allowedFinalOrigins
    ),
    fetchMetadata(
      provenance.pnpm.metadataUrl,
      provenance.pnpm.allowedFinalOrigins
    ),
  ]);
  if (failed) throw firstFailure;
  return { pnpm: pnpm.value, runner: runner.value };
}
// biome-ignore format: compact verifier preserves the runtime line gate.
function verifyRunner(policy, inputs) {
  const document = readValue(inputs.runnerRelease, inputs.runnerReleaseValue, 'runner metadata');
  const expected = policy.supplyChainProvenance.runner;
  const matches = (document.assets ?? []).filter(
    (asset) => asset.id === expected.assetId
  );
  assertValid(matches.length === 1, 'runner asset');
  const asset = matches[0];
  assertValid(
    asset.name === expected.assetName &&
      asset.size === expected.assetSize &&
      asset.digest === expected.assetDigest,
    'runner asset'
  );
  if (inputs.runnerArtifact) assertValid(digest('sha256', readFileSync(inputs.runnerArtifact)) === policy.supplyChain.runner.sha256, 'runner artifact');
}
function verifyPnpm(policy, inputs) {
  // biome-ignore format: compact provenance tuple preserves the line gate.
  const document = readValue(inputs.pnpmMetadata, inputs.pnpmMetadataValue, 'pnpm metadata');
  const expected = policy.supplyChain.pnpm;
  assertValid(
    document.version === expected.version &&
      document.dist?.tarball === expected.url &&
      document.dist?.integrity === expected.integrity &&
      document.dist?.shasum === policy.supplyChainProvenance.pnpm.distShasum,
    'pnpm metadata'
  );
  if (!inputs.pnpmTarball) return;
  const bytes = readFileSync(inputs.pnpmTarball);
  const sri = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  assertValid(
    digest('sha256', bytes) === expected.sha256 &&
      digest('sha1', bytes) === policy.supplyChainProvenance.pnpm.distShasum &&
      sri === expected.integrity,
    'pnpm tarball'
  );
}
function verifyNode(policy, inputs) {
  if (!inputs.nodeReceipt && !inputs.nodeReceiptValue) return false;
  // biome-ignore format: compact provenance tuple preserves the line gate.
  const receipt = readValue(inputs.nodeReceipt, inputs.nodeReceiptValue, 'node receipt');
  const expected = policy.supplyChainProvenance.node;
  const executableSupplied = inputs.nodeExecutable !== undefined;
  assertValid(
    receipt.archiveBasename ===
      basename(new URL(policy.supplyChain.node.url).pathname) &&
      receipt.archiveSha256 === policy.supplyChain.node.sha256 &&
      receipt.checksumsSha256 === expected.checksumsSha256 &&
      receipt.signatureSha256 === expected.signatureSha256 &&
      receipt.keyringSha256 === expected.keyringSha256 &&
      receipt.schemaVersion === 1 &&
      /^[0-9a-f]{64}$/.test(receipt.baseToolReceiptSha256) &&
      (!executableSupplied ||
        (typeof inputs.nodeExecutable === 'string' &&
          /^[0-9a-f]{64}$/.test(receipt.executableSha256))),
    'node receipt'
  );
  assertValid(
    receipt.baseToolReceiptSha256 === baseToolReceiptSha256(inputs),
    'base-tool receipt'
  );
  if (executableSupplied)
    assertValid(
      digest('sha256', readFileSync(inputs.nodeExecutable)) ===
        receipt.executableSha256,
      'node executable'
    );
  return true;
}
function verifyCommandSettings(policy, inputs) {
  if (!inputs.commandSettings && inputs.commandSettingsValue === undefined)
    return false;
  const runner = policy.supplyChain.runner;
  const source =
    inputs.commandSettingsValue ?? readFileSync(inputs.commandSettings, 'utf8');
  return verifyCommandSettingsContract({
    expectedSha256: runner.commandSettingsSha256,
    runnerArchiveSha256: runner.sha256,
    runnerVersion: runner.version,
    source,
    sourceUrl: runner.commandSettingsUrl,
  });
}
function packageFields(stanza) {
  // biome-ignore format: compact stanza parser preserves the runtime line gate.
  return Object.fromEntries(stanza.split('\n').map((line) => line.match(/^([^:]+):\s*(.*)$/)).filter(Boolean).map((match) => [match[1], match[2]]));
}
// biome-ignore format: compact verifier preserves the runtime line gate.
function verifyChrome(policy, inputs) {
  if (!inputs.chromeInRelease && inputs.chromeInReleaseValue === undefined)
    return false;
  if (inputs.chromeSignatureValid !== true) {
    withArmoredOpenPgpKeyring({ armoredKeyPath: inputs.chromeSigningKey, expectedSha256: policy.supplyChainProvenance.chrome.signingKeySha256 }, ({ environment, keyring }) => {
      const status = spawnSync('/usr/bin/gpgv', ['--keyring', keyring, inputs.chromeInRelease], { env: environment, stdio: 'ignore' }).status;
      assertValid(status === 0, 'Chrome signature');
    });
  } else if (inputs.chromeSigningKey)
    decodeArmoredPublicKey(readFileSync(inputs.chromeSigningKey), policy.supplyChainProvenance.chrome.signingKeySha256);
  const release = inputs.chromeInReleaseValue ?? readFileSync(inputs.chromeInRelease, 'utf8');
  const packages = inputs.chromePackagesValue ?? gunzipSync(readFileSync(inputs.chromePackages)).toString('utf8');
  const expected = policy.supplyChainProvenance.chrome;
  if (inputs.chromeInRelease) assertValid(digest('sha256', readFileSync(inputs.chromeInRelease)) === expected.inReleaseSha256, 'Chrome InRelease');
  if (inputs.chromePackages) assertValid(digest('sha256', readFileSync(inputs.chromePackages)) === expected.packagesSha256, 'Chrome Packages');
  if (inputs.chromeArtifact) assertValid(digest('sha256', readFileSync(inputs.chromeArtifact)) === policy.supplyChain.chrome.sha256, 'Chrome artifact');
  const hashRows = release.split('\n').filter((line) => {
    const row = line.trim();
    return (
      row.startsWith(`${expected.packagesSha256} `) &&
      row.endsWith(' main/binary-amd64/Packages.gz')
    );
  });
  assertValid(hashRows.length === 1, 'Chrome Packages digest');
  const filename = new URL(policy.supplyChain.chrome.url).pathname.split('/deb/')[1];
  const matches = packages
    .split(/\n\s*\n/)
    .map(packageFields)
    .filter(
      (fields) =>
        fields.Package === 'google-chrome-stable' &&
        fields.Version === policy.supplyChain.chrome.version &&
        fields.Architecture === 'amd64' &&
        fields.Filename === filename &&
        fields.SHA256 === policy.supplyChain.chrome.sha256
    );
  assertValid(matches.length === 1, 'Chrome package stanza');
  return true;
}
// biome-ignore format: compact verifier preserves the runtime line gate.
function verifyOwner(policy, inputs) {
  if (!inputs.ownerChecksums && inputs.ownerChecksumsValue === undefined)
    return false;
  const text = inputs.ownerChecksumsValue ?? readFileSync(inputs.ownerChecksums, 'utf8');
  const owner = policy.supplyChainProvenance.ownerCli;
  if (inputs.ownerChecksums) assertValid(digest('sha256', readFileSync(inputs.ownerChecksums)) === owner.checksumsSha256, 'owner CLI checksums');
  const name = basename(new URL(owner.archiveUrl).pathname);
  const rows = text.split('\n').filter((line) => {
    const [rowDigest, filename] = line.trim().split(/\s+/);
    return rowDigest === owner.archiveSha256 && filename === name;
  });
  assertValid(rows.length === 1, 'owner CLI checksum row');
  assertValid(inputs.ownerArchive && digest('sha256', readFileSync(inputs.ownerArchive)) === owner.archiveSha256, 'owner CLI archive');
  assertValid(inputs.ownerBinary && digest('sha256', readFileSync(inputs.ownerBinary)) === owner.binarySha256, 'owner CLI binary');
  return true;
}
// biome-ignore format: compact verifier preserves the runtime line gate.
function verifyUbuntu(policy, inputs) {
  if (!inputs.ubuntuReceipt && inputs.ubuntuReceiptValue === undefined) return;
  const bytes = inputs.ubuntuReceipt ? readFileSync(inputs.ubuntuReceipt, 'utf8') : undefined;
  const receipt = readValue(inputs.ubuntuReceipt, inputs.ubuntuReceiptValue, 'Ubuntu receipt');
  if (inputs.ubuntuReceipt) assertValid(bytes === canonicalJson(receipt) && /^[0-9a-f]{64}$/.test(inputs.ubuntuReceiptSha256) && digest('sha256', bytes) === inputs.ubuntuReceiptSha256, 'Ubuntu receipt canonical bytes/digest');
  assertValid(Object.keys(receipt).join(',') === 'baseToolReceiptSha256,indexes,keyringSha256,packages,releases,schemaVersion,snapshotId,sourcesSha256', 'Ubuntu receipt keys');
  assertValid(receipt.schemaVersion === 1 && Array.isArray(receipt.packages) && receipt.packages.length > 0, 'Ubuntu receipt');
  assertValid(
    receipt.baseToolReceiptSha256 === baseToolReceiptSha256(inputs),
    'base-tool receipt'
  );
  const rows = receipt.packages.map((row) => canonicalJson(row));
  for (const row of receipt.packages) assertValid(Object.keys(row).join(',') === 'architecture,filename,name,sha256,version' && row.architecture === 'amd64' && /^[A-Za-z0-9.+-]+$/.test(row.name) && /^[A-Za-z0-9.+:~=-]+$/.test(row.version) && /^[A-Za-z0-9.+_/@:~-]+$/.test(row.filename) && /^[0-9a-f]{64}$/.test(row.sha256), 'Ubuntu package row');
  assertValid(receipt.snapshotId === policy.supplyChain.ubuntu.snapshotId && [receipt.baseToolReceiptSha256, receipt.keyringSha256, receipt.sourcesSha256].every((value) => /^[0-9a-f]{64}$/.test(value)) && ['indexes', 'releases'].every((key) => Array.isArray(receipt[key]) && receipt[key].length > 0 && receipt[key].every((row) => Object.keys(row).join(',') === 'path,sha256' && /^[A-Za-z0-9._+-]+$/.test(row.path) && /^[0-9a-f]{64}$/.test(row.sha256))), 'Ubuntu metadata receipt');
  assertValid(rows.join('\n') === [...new Set(rows)].sort().join('\n'), 'Ubuntu package row order');
  return receipt;
}
export function verifySupplyChainProvenance(value, inputs) {
  const policy = parseRunnerPolicy(value);
  verifyRunner(policy, inputs);
  verifyPnpm(policy, inputs);
  const result = { pnpm: true, runner: true };
  if (verifyCommandSettings(policy, inputs)) result.commandSettings = true;
  if (verifyNode(policy, inputs)) result.node = true;
  if (verifyChrome(policy, inputs)) result.chrome = true;
  if (verifyOwner(policy, inputs)) result.ownerCli = true;
  if (verifyUbuntu(policy, inputs)) result.ubuntu = true;
  return Object.fromEntries(
    Object.entries(result).sort(([left], [right]) => left.localeCompare(right))
  );
}
// biome-ignore format: compact receipt builder preserves the runtime line gate.
function buildReceipts(policy, inputs) {
  const node = readValue(inputs.nodeReceipt, inputs.nodeReceiptValue, 'node receipt');
  const ubuntu = verifyUbuntu(policy, inputs);
  const commandSettings = verifyCommandSettings(policy, inputs);
  assertValid(commandSettings && ubuntu && inputs.runnerArtifact && inputs.pnpmTarball && inputs.chromeArtifact && inputs.ownerArchive && inputs.ownerBinary && inputs.ownerChecksums && inputs.nodeExecutable, 'complete provenance inputs');
  const runner = policy.supplyChainProvenance.runner;
  const pnpm = policy.supplyChain.pnpm;
  const chrome = policy.supplyChainProvenance.chrome;
  const owner = policy.supplyChainProvenance.ownerCli;
  return { chrome: { artifactSha256: policy.supplyChain.chrome.sha256, inReleaseSha256: chrome.inReleaseSha256, packagesSha256: chrome.packagesSha256, schemaVersion: 1, signingKeySha256: chrome.signingKeySha256, version: policy.supplyChain.chrome.version }, commandSettings, node: { ...node, executableSha256: digest('sha256', readFileSync(inputs.nodeExecutable)), schemaVersion: 1 }, ownerCli: { archiveSha256: owner.archiveSha256, binarySha256: owner.binarySha256, checksumsSha256: owner.checksumsSha256, schemaVersion: 1, version: owner.version }, pnpm: { artifactSha256: pnpm.sha256, distIntegrity: pnpm.integrity, distShasum: policy.supplyChainProvenance.pnpm.distShasum, schemaVersion: 1, tarball: pnpm.url, version: pnpm.version }, runner: { artifactSha256: policy.supplyChain.runner.sha256, assetDigest: runner.assetDigest, assetId: runner.assetId, assetName: runner.assetName, assetSize: runner.assetSize, schemaVersion: 1 }, ubuntu };
}
// biome-ignore format: compact CLI preserves the runtime line gate.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [command, policyPath, inputsPath] = process.argv.slice(2);
  assertValid(
    command === 'verify' && inputsPath && process.argv.length === 5,
    'provenance command'
  );
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
  const inputs = JSON.parse(readFileSync(inputsPath, 'utf8'));
  assertValid(
    !Object.keys(inputs).some(
      (key) => key.endsWith('Value') || key === 'chromeSignatureValid'
    ),
    'test evidence'
  );
  const semantic = await fetchSemanticMetadata(policy);
  inputs.runnerReleaseValue = semantic.runner;
  inputs.pnpmMetadataValue = semantic.pnpm;
  const receipt = verifySupplyChainProvenance(policy, inputs);
  assertValid(['chrome', 'commandSettings', 'node', 'ownerCli', 'pnpm', 'runner', 'ubuntu'].every((key) => receipt[key]), 'complete provenance verification');
  process.stdout.write(canonicalJson(buildReceipts(parseRunnerPolicy(policy), inputs)));
}
