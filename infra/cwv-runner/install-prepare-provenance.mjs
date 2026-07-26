import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';

const HEX = /^[0-9a-f]{64}$/;
const PATHS = Object.freeze({
  baseTools: '/opt/baci-cwv/provenance/base-tools.json',
  chrome: '/opt/baci-cwv/provenance/chrome.json',
  node: '/opt/baci-cwv/provenance/node.json',
  ownerCli: '/opt/baci-cwv/provenance/owner-cli.json',
  pnpm: '/opt/baci-cwv/provenance/pnpm.json',
  runner: '/opt/baci-cwv/provenance/runner.json',
  ubuntu: '/opt/baci-cwv/provenance/ubuntu.json',
});
const KEYS = Object.freeze({
  baseTools: ['baseImageDigest', 'inventorySha256', 'schemaVersion', 'tools'],
  chrome: [
    'artifactSha256',
    'inReleaseSha256',
    'packagesSha256',
    'schemaVersion',
    'signingKeySha256',
    'version',
  ],
  node: [
    'archiveBasename',
    'archiveSha256',
    'baseToolReceiptSha256',
    'checksumsSha256',
    'executableSha256',
    'keyringSha256',
    'schemaVersion',
    'signatureSha256',
  ],
  ownerCli: [
    'archiveSha256',
    'binarySha256',
    'checksumsSha256',
    'schemaVersion',
    'version',
  ],
  pnpm: [
    'artifactSha256',
    'distIntegrity',
    'distShasum',
    'schemaVersion',
    'tarball',
    'version',
  ],
  runner: [
    'artifactSha256',
    'assetDigest',
    'assetId',
    'assetName',
    'assetSize',
    'schemaVersion',
  ],
  ubuntu: [
    'baseToolReceiptSha256',
    'indexes',
    'keyringSha256',
    'packages',
    'releases',
    'schemaVersion',
    'snapshotId',
    'sourcesSha256',
  ],
});
const REQUIRED_BASE_TOOL_ROLES = [
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
  'ldd',
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
  'keyring',
];

const exactKeys = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const fail = () => {
  throw new TypeError('invalid build provenance');
};

function validatePolicyBinding(name, receipt, policy) {
  const chain = policy.supplyChain;
  const source = policy.supplyChainProvenance;
  const invalid =
    (name === 'chrome' &&
      (receipt.artifactSha256 !== chain.chrome.sha256 ||
        receipt.inReleaseSha256 !== source.chrome.inReleaseSha256 ||
        receipt.packagesSha256 !== source.chrome.packagesSha256 ||
        receipt.signingKeySha256 !== source.chrome.signingKeySha256 ||
        receipt.version !== chain.chrome.version)) ||
    (name === 'node' &&
      (receipt.archiveBasename !==
        new URL(chain.node.url).pathname.split('/').at(-1) ||
        receipt.archiveSha256 !== chain.node.sha256 ||
        receipt.checksumsSha256 !== source.node.checksumsSha256 ||
        receipt.keyringSha256 !== source.node.keyringSha256 ||
        receipt.signatureSha256 !== source.node.signatureSha256)) ||
    (name === 'ownerCli' &&
      (receipt.archiveSha256 !== source.ownerCli.archiveSha256 ||
        receipt.binarySha256 !== source.ownerCli.binarySha256 ||
        receipt.checksumsSha256 !== source.ownerCli.checksumsSha256 ||
        receipt.version !== source.ownerCli.version)) ||
    (name === 'pnpm' &&
      (receipt.artifactSha256 !== chain.pnpm.sha256 ||
        receipt.distIntegrity !== chain.pnpm.integrity ||
        receipt.distShasum !== source.pnpm.distShasum ||
        receipt.tarball !== chain.pnpm.url ||
        receipt.version !== chain.pnpm.version)) ||
    (name === 'runner' &&
      (receipt.artifactSha256 !== chain.runner.sha256 ||
        receipt.assetDigest !== source.runner.assetDigest ||
        receipt.assetId !== source.runner.assetId ||
        receipt.assetName !== source.runner.assetName ||
        receipt.assetSize !== source.runner.assetSize));
  if (invalid) fail();
}

function validBaseTool(row) {
  return (
    exactKeys(row, [
      'linkIdentity',
      'mode',
      'owner',
      'package',
      'path',
      'role',
      'sha256',
      'version',
    ]) &&
    typeof row.linkIdentity === 'string' &&
    /^[0-7]{3,4}$/.test(row.mode) &&
    /^\d+:\d+$/.test(row.owner) &&
    typeof row.package === 'string' &&
    /^\/[A-Za-z0-9_./+-]+$/.test(row.path) &&
    typeof row.role === 'string' &&
    typeof row.version === 'string' &&
    HEX.test(row.sha256)
  );
}

function validateBaseTools(receipt, policy) {
  const roles = Array.isArray(receipt.tools)
    ? receipt.tools.map((row) => row?.role)
    : [];
  if (
    receipt.baseImageDigest !== policy.supplyChain.ubuntu.reference ||
    !receipt.tools?.length ||
    !receipt.tools.every(validBaseTool) ||
    canonicalJson(roles) !== canonicalJson([...roles].sort()) ||
    new Set(roles).size !== roles.length ||
    !REQUIRED_BASE_TOOL_ROLES.every((role) => roles.includes(role)) ||
    !roles.some((role) => role.startsWith('interpreter:')) ||
    !roles.some((role) => role.startsWith('library:')) ||
    roles.some(
      (role) =>
        !REQUIRED_BASE_TOOL_ROLES.includes(role) &&
        !/^(?:interpreter|library):[A-Za-z0-9:._/-]+$/.test(role)
    ) ||
    receipt.tools.find((row) => row.role === 'keyring')?.path !==
      '/usr/share/keyrings/ubuntu-archive-keyring.gpg'
  )
    fail();
}

function validateUbuntu(receipt, provenance, policy) {
  const hasRows = ['indexes', 'packages', 'releases'].every(
    (key) => Array.isArray(receipt[key]) && receipt[key].length
  );
  const baseTools = provenance.baseTools;
  const keyring = baseTools?.receipt?.tools?.find(
    (row) => row.role === 'keyring'
  );
  if (
    receipt.snapshotId !== policy.supplyChain.ubuntu.snapshotId ||
    receipt.baseToolReceiptSha256 !== baseTools?.sha256 ||
    receipt.keyringSha256 !== keyring?.sha256 ||
    !hasRows ||
    !receipt.indexes.every(
      (row) => exactKeys(row, ['path', 'sha256']) && HEX.test(row.sha256)
    ) ||
    !receipt.releases.every(
      (row) => exactKeys(row, ['path', 'sha256']) && HEX.test(row.sha256)
    ) ||
    !receipt.packages.every(
      (row) =>
        exactKeys(row, [
          'architecture',
          'filename',
          'name',
          'sha256',
          'version',
        ]) && HEX.test(row.sha256)
    )
  )
    fail();
}

function validateReceipt(name, receipt, provenance, policy) {
  if (!exactKeys(receipt, KEYS[name]) || receipt.schemaVersion !== 1) fail();
  for (const [key, value] of Object.entries(receipt)) {
    if (key.endsWith('Sha256') && !HEX.test(value)) fail();
  }
  validatePolicyBinding(name, receipt, policy);
  if (name === 'baseTools') validateBaseTools(receipt, policy);
  if (name === 'ubuntu') validateUbuntu(receipt, provenance, policy);
}

export function validateBuildProvenance(value, policy) {
  if (!exactKeys(value, Object.keys(PATHS))) fail();
  for (const [name, path] of Object.entries(PATHS)) {
    const row = value[name];
    if (
      !exactKeys(row, ['path', 'receipt', 'sha256']) ||
      row.path !== path ||
      !HEX.test(row.sha256) ||
      !row.receipt ||
      typeof row.receipt !== 'object' ||
      Array.isArray(row.receipt) ||
      row.sha256 !== canonicalSha256(row.receipt)
    )
      fail();
    validateReceipt(name, row.receipt, value, policy);
  }
}
