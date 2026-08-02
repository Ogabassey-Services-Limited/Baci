import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalJson } from './canonical-json.mjs';
import { verifySupplyChainProvenance } from './supply-chain-provenance.mjs';

const loadPolicy = () =>
  JSON.parse(readFileSync(new URL('policy.json', import.meta.url), 'utf8'));
const baseInputs = (policy) => ({
  pnpmMetadataValue: {
    dist: {
      integrity: policy.supplyChain.pnpm.integrity,
      shasum: policy.supplyChainProvenance.pnpm.distShasum,
      tarball: policy.supplyChain.pnpm.url,
    },
    version: policy.supplyChain.pnpm.version,
  },
  runnerReleaseValue: {
    assets: [
      {
        digest: policy.supplyChainProvenance.runner.assetDigest,
        id: policy.supplyChainProvenance.runner.assetId,
        name: policy.supplyChainProvenance.runner.assetName,
        size: policy.supplyChainProvenance.runner.assetSize,
      },
    ],
  },
});
const ubuntuReceipt = (policy) => ({
  baseToolReceiptSha256: '0'.repeat(64),
  indexes: [{ path: 'index_Packages', sha256: '1'.repeat(64) }],
  keyringSha256: '2'.repeat(64),
  packages: [
    {
      architecture: 'amd64',
      filename: 'pool/x.deb',
      name: 'x',
      sha256: '3'.repeat(64),
      version: '1',
    },
  ],
  releases: [{ path: 'suite_InRelease', sha256: '4'.repeat(64) }],
  schemaVersion: 1,
  snapshotId: policy.supplyChain.ubuntu.snapshotId,
  sourcesSha256: '5'.repeat(64),
});

test('provenance verifies Node, Ubuntu, and Chrome documents', () => {
  const policy = loadPolicy();
  const dir = mkdtempSync(join(tmpdir(), 'cwv-base-tools-'));
  const baseToolReceipt = join(dir, 'base-tools.json');
  writeFileSync(
    baseToolReceipt,
    canonicalJson({ schemaVersion: 1, tools: [] })
  );
  const baseToolReceiptSha256 = createHash('sha256')
    .update(readFileSync(baseToolReceipt))
    .digest('hex');
  const nodeName = new URL(policy.supplyChain.node.url).pathname
    .split('/')
    .at(-1);
  const chromeName = new URL(policy.supplyChain.chrome.url).pathname
    .split('/')
    .at(-1);
  const result = verifySupplyChainProvenance(policy, {
    ...baseInputs(policy),
    baseToolReceipt,
    chromeInReleaseValue: `SHA256:\n ${policy.supplyChainProvenance.chrome.packagesSha256} 42 main/binary-amd64/Packages.gz\n`,
    chromePackagesValue: `Package: google-chrome-stable\nVersion: ${policy.supplyChain.chrome.version}\nArchitecture: amd64\nFilename: pool/main/g/google-chrome-stable/${chromeName}\nSHA256: ${policy.supplyChain.chrome.sha256}\n`,
    chromeSignatureValid: true,
    nodeReceiptValue: {
      archiveBasename: nodeName,
      archiveSha256: policy.supplyChain.node.sha256,
      baseToolReceiptSha256,
      checksumsSha256: policy.supplyChainProvenance.node.checksumsSha256,
      keyringSha256: policy.supplyChainProvenance.node.keyringSha256,
      schemaVersion: 1,
      signatureSha256: policy.supplyChainProvenance.node.signatureSha256,
    },
    ubuntuReceiptValue: { ...ubuntuReceipt(policy), baseToolReceiptSha256 },
  });
  assert.deepEqual(result, {
    chrome: true,
    node: true,
    pnpm: true,
    runner: true,
    ubuntu: true,
  });
});

test('Chrome signature verification invokes the frozen absolute gpgv path', () => {
  const source = readFileSync(
    new URL('supply-chain-provenance.mjs', import.meta.url),
    'utf8'
  );
  assert.match(source, /spawnSync\('\/usr\/bin\/gpgv',/);
  assert.doesNotMatch(source, /spawnSync\('gpgv',/);
});

test('Ubuntu receipt refuses noncanonical bytes and unexpected fields', () => {
  const policy = loadPolicy();
  const dir = mkdtempSync(join(tmpdir(), 'cwv-ubuntu-'));
  const path = join(dir, 'receipt.json');
  const receipt = ubuntuReceipt(policy);
  writeFileSync(path, JSON.stringify(receipt, null, 2));
  assert.throws(
    () =>
      verifySupplyChainProvenance(policy, {
        ...baseInputs(policy),
        ubuntuReceipt: path,
        ubuntuReceiptSha256: '0'.repeat(64),
      }),
    /canonical bytes/
  );
  const extra = {
    ...receipt,
    indexes: [{ extra: true, ...receipt.indexes[0] }],
  };
  const baseToolReceipt = join(dir, 'base-tools.json');
  writeFileSync(
    baseToolReceipt,
    canonicalJson({ schemaVersion: 1, tools: [] })
  );
  extra.baseToolReceiptSha256 = createHash('sha256')
    .update(readFileSync(baseToolReceipt))
    .digest('hex');
  const bytes = JSON.stringify(extra);
  writeFileSync(path, bytes);
  assert.throws(
    () =>
      verifySupplyChainProvenance(policy, {
        ...baseInputs(policy),
        baseToolReceipt,
        ubuntuReceipt: path,
        ubuntuReceiptSha256: createHash('sha256').update(bytes).digest('hex'),
      }),
    /metadata receipt/
  );
});

test('Docker mounts every provenance input in the verified invocation order', () => {
  const dockerfile = readFileSync(
    new URL('Dockerfile', import.meta.url),
    'utf8'
  );
  assert.match(
    dockerfile,
    /node_receipt_sha=\$\(\/opt\/baci-cwv\/verify-node-bootstrap\.sh[^;]+"\$work\/node-receipt\.json"\); \\\n\s+mkdir -p "\$work\/node";[^\n]+\\\n\s+test -x "\$work\/node\/bin\/node"; \\\n\s+node_provenance_receipt_sha=\$\(\/opt\/baci-cwv\/verify-node-bootstrap\.sh augment "\$work\/node-receipt\.json" "\$node_receipt_sha" "\$work\/base-tools-before-node\.json" "\$base_tools_receipt_sha" "\$work\/node\/bin\/node" "\$work\/node-provenance\.json"\);/
  );
  const start = dockerfile.indexOf('    jq -n --arg baseToolReceipt');
  const end = dockerfile.indexOf("    jq -e '.chrome", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.equal(
    dockerfile.slice(start, end),
    `${[
      '    jq -n --arg baseToolReceipt /opt/baci-cwv/provenance/base-tools.json --arg commandSettings "$work/command-settings" --arg nodeReceipt "$work/node-provenance.json" --arg nodeExecutable "$work/node/bin/node" \\',
      '      --arg runnerArtifact "$work/runner.artifact" --arg pnpmTarball "$work/pnpm.artifact" \\',
      '      --arg ubuntuReceipt /opt/baci-cwv/provenance/ubuntu.json \\',
      '      --arg ubuntuReceiptSha256 "$(cat /opt/baci-cwv/provenance/.ubuntu.sha256)" --arg chromeArtifact "$work/chrome.artifact" \\',
      '      --arg chromeInRelease "$work/chrome-inRelease" --arg chromePackages "$work/chrome-packages" \\',
      '      --arg chromeSigningKey "$work/chrome-signingKey" --arg ownerChecksums "$work/owner-checksums" \\',
      '      --arg ownerArchive "$work/owner-archive" --arg ownerBinary "$work/owner-binary" \\',
      '      \'{baseToolReceipt:$baseToolReceipt,commandSettings:$commandSettings,ubuntuReceipt:$ubuntuReceipt,ubuntuReceiptSha256:$ubuntuReceiptSha256,nodeReceipt:$nodeReceipt,nodeExecutable:$nodeExecutable,runnerArtifact:$runnerArtifact,pnpmTarball:$pnpmTarball,chromeArtifact:$chromeArtifact,chromeInRelease:$chromeInRelease,chromePackages:$chromePackages,chromeSigningKey:$chromeSigningKey,ownerChecksums:$ownerChecksums,ownerArchive:$ownerArchive,ownerBinary:$ownerBinary}\' >"$work/provenance-inputs.json"; \\',
      '    "$work/node/bin/node" /opt/baci-cwv/supply-chain-provenance.mjs verify \\',
      '      /opt/baci-cwv/policy.json "$work/provenance-inputs.json" >"$work/provenance-receipt.json"; \\',
    ].join('\n')}\n`
  );
});
