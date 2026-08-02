import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { canonicalJson } from './canonical-json.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';

const root = new URL('.', import.meta.url);
export const policyBytes = readFileSync(new URL('policy.json', root));
export const policy = parseRunnerPolicy(JSON.parse(policyBytes));
export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
const digest = 'a'.repeat(64);
const chain = policy.supplyChain;
const source = policy.supplyChainProvenance;

const baseTools = {
  baseImageDigest: policy.supplyChain.ubuntu.reference,
  inventorySha256: digest,
  schemaVersion: 1,
  tools: [
    'apt-get',
    'awk',
    'awk:alternative',
    'awk:target',
    'base64',
    'bash',
    'chmod',
    'cp',
    'dpkg',
    'dpkg-query',
    'find',
    'gpgv',
    'grep',
    'interpreter:loader',
    'keyring',
    'ldd',
    'library:libc',
    'mkdir',
    'mktemp',
    'mv',
    'readlink',
    'rm',
    'sha256sum',
    'sort',
    'stat',
    'timeout',
    'wc',
  ].map((role) => ({
    linkIdentity: `'/${role}'`,
    mode: '755',
    owner: '0:0',
    package: 'base',
    path:
      role === 'keyring'
        ? '/usr/share/keyrings/ubuntu-archive-keyring.gpg'
        : `/${role.replace(':', '-')}`,
    role,
    sha256: digest,
    version: '1',
  })),
};
const baseToolReceiptSha256 = sha256(canonicalJson(baseTools));

export const provenance = {
  'base-tools': baseTools,
  chrome: {
    artifactSha256: chain.chrome.sha256,
    inReleaseSha256: source.chrome.inReleaseSha256,
    packagesSha256: source.chrome.packagesSha256,
    schemaVersion: 1,
    signingKeySha256: source.chrome.signingKeySha256,
    version: chain.chrome.version,
  },
  node: {
    archiveBasename: new URL(chain.node.url).pathname.split('/').at(-1),
    archiveSha256: chain.node.sha256,
    baseToolReceiptSha256,
    checksumsSha256: source.node.checksumsSha256,
    executableSha256: digest,
    keyringSha256: source.node.keyringSha256,
    schemaVersion: 1,
    signatureSha256: source.node.signatureSha256,
  },
  'owner-cli': {
    archiveSha256: source.ownerCli.archiveSha256,
    binarySha256: source.ownerCli.binarySha256,
    checksumsSha256: source.ownerCli.checksumsSha256,
    schemaVersion: 1,
    version: source.ownerCli.version,
  },
  pnpm: {
    artifactSha256: chain.pnpm.sha256,
    distIntegrity: chain.pnpm.integrity,
    distShasum: source.pnpm.distShasum,
    schemaVersion: 1,
    tarball: chain.pnpm.url,
    version: chain.pnpm.version,
  },
  runner: {
    artifactSha256: chain.runner.sha256,
    assetDigest: source.runner.assetDigest,
    assetId: source.runner.assetId,
    assetName: source.runner.assetName,
    assetSize: source.runner.assetSize,
    schemaVersion: 1,
  },
  ubuntu: {
    baseToolReceiptSha256,
    indexes: [{ path: 'Packages', sha256: digest }],
    keyringSha256: digest,
    packages: [
      'a',
      'bash',
      'ca-certificates',
      'coreutils',
      'dash',
      'dpkg',
      'git',
      'grep',
      'libc6',
      'mawk',
      'util-linux',
    ].map((name) => ({
      architecture: 'amd64',
      filename: 'pool/a.deb',
      name,
      sha256: digest,
      version: '1',
    })),
    releases: [{ path: 'InRelease', sha256: digest }],
    schemaVersion: 1,
    snapshotId: policy.supplyChain.ubuntu.snapshotId,
    sourcesSha256: digest,
  },
};

export { chain, digest, source };
export const sealedRuntimePaths = [
  'opt/baci-cwv/command-settings-contract.mjs',
  'opt/baci-cwv/command-settings-receipt.json',
  'opt/baci-cwv/container-attest-runtime.mjs',
  'opt/baci-cwv/cwv-runner-authority.mjs',
  'opt/baci-cwv/cwv-runner-authority-core.mjs',
  'opt/baci-cwv/cwv-runner-authority-runtime.mjs',
  'opt/baci-cwv/cwv-runner-stable-attestation-builder.mjs',
  'opt/baci-cwv/direct-listener-conformance.mjs',
  'opt/baci-cwv/entrypoint-runtime.mjs',
  'opt/baci-cwv/entrypoint.mjs',
  'opt/baci-cwv/entrypoint.sh',
  'opt/baci-cwv/normal-release.mjs',
  'opt/baci-cwv/process-inventory.mjs',
  'opt/baci-cwv/registration-egress-probe.mjs',
  'opt/baci-cwv/registration-release.mjs',
  'opt/baci-cwv/runner-identity-gate.mjs',
  'opt/baci-cwv/isolation-probe.sh',
  'opt/runner/bin/Runner.Listener',
  'opt/runner/entrypoint.mjs',
];
