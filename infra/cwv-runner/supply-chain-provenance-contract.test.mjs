import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import { verifySupplyChainProvenance } from './supply-chain-provenance.mjs';

const policy = JSON.parse(
  readFileSync(new URL('policy.json', import.meta.url))
);
const semantic = {
  pnpmMetadataValue: {
    version: policy.supplyChain.pnpm.version,
    dist: {
      tarball: policy.supplyChain.pnpm.url,
      integrity: policy.supplyChain.pnpm.integrity,
      shasum: policy.supplyChainProvenance.pnpm.distShasum,
    },
  },
  runnerReleaseValue: {
    assets: [
      {
        id: policy.supplyChainProvenance.runner.assetId,
        name: policy.supplyChainProvenance.runner.assetName,
        size: policy.supplyChainProvenance.runner.assetSize,
        digest: policy.supplyChainProvenance.runner.assetDigest,
      },
    ],
  },
};

test('Node and Ubuntu receipts bind actual canonical base-tool receipt bytes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-base-binding-'));
  const baseToolReceipt = join(dir, 'base-tools.json');
  writeFileSync(
    baseToolReceipt,
    canonicalJson({ schemaVersion: 1, tools: [] })
  );
  const baseToolReceiptSha256 = createHash('sha256')
    .update(readFileSync(baseToolReceipt))
    .digest('hex');
  const nodeReceiptValue = {
    archiveBasename: new URL(policy.supplyChain.node.url).pathname
      .split('/')
      .at(-1),
    archiveSha256: policy.supplyChain.node.sha256,
    baseToolReceiptSha256,
    checksumsSha256: policy.supplyChainProvenance.node.checksumsSha256,
    keyringSha256: policy.supplyChainProvenance.node.keyringSha256,
    schemaVersion: 1,
    signatureSha256: policy.supplyChainProvenance.node.signatureSha256,
  };
  const ubuntuReceiptValue = {
    baseToolReceiptSha256,
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
  };
  assert.deepEqual(
    verifySupplyChainProvenance(policy, {
      ...semantic,
      baseToolReceipt,
      nodeReceiptValue,
      ubuntuReceiptValue,
    }),
    { node: true, pnpm: true, runner: true, ubuntu: true }
  );
  assert.throws(
    () =>
      verifySupplyChainProvenance(policy, {
        ...semantic,
        baseToolReceipt,
        nodeReceiptValue: {
          ...nodeReceiptValue,
          baseToolReceiptSha256: '0'.repeat(64),
        },
      }),
    /base-tool receipt/
  );
});

test('Node executable evidence requires a valid receipt executable digest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-node-executable-binding-'));
  const baseToolReceipt = join(dir, 'base-tools.json');
  const nodeExecutable = join(dir, 'node');
  writeFileSync(baseToolReceipt, canonicalJson({ schemaVersion: 1 }));
  writeFileSync(nodeExecutable, 'node executable bytes');
  const baseToolReceiptSha256 = createHash('sha256')
    .update(readFileSync(baseToolReceipt))
    .digest('hex');
  const receipt = {
    archiveBasename: new URL(policy.supplyChain.node.url).pathname
      .split('/')
      .at(-1),
    archiveSha256: policy.supplyChain.node.sha256,
    baseToolReceiptSha256,
    checksumsSha256: policy.supplyChainProvenance.node.checksumsSha256,
    executableSha256: createHash('sha256')
      .update(readFileSync(nodeExecutable))
      .digest('hex'),
    keyringSha256: policy.supplyChainProvenance.node.keyringSha256,
    schemaVersion: 1,
    signatureSha256: policy.supplyChainProvenance.node.signatureSha256,
  };
  assert.equal(
    verifySupplyChainProvenance(policy, {
      ...semantic,
      baseToolReceipt,
      nodeExecutable,
      nodeReceiptValue: receipt,
    }).node,
    true
  );
  for (const executableSha256 of [undefined, 'not-a-digest'])
    assert.throws(
      () =>
        verifySupplyChainProvenance(policy, {
          ...semantic,
          baseToolReceipt,
          nodeExecutable,
          nodeReceiptValue: { ...receipt, executableSha256 },
        }),
      /node receipt/
    );
});

test('provenance CLI rejects every test-only evidence override before fetching', () => {
  const program = new URL('supply-chain-provenance.mjs', import.meta.url)
    .pathname;
  const policyPath = new URL('policy.json', import.meta.url).pathname;
  for (const key of [
    'runnerReleaseValue',
    'pnpmMetadataValue',
    'chromeInReleaseValue',
    'chromeSignatureValid',
  ]) {
    const path = join(
      mkdtempSync(join(tmpdir(), 'cwv-cli-evidence-')),
      'inputs.json'
    );
    writeFileSync(
      path,
      JSON.stringify({ [key]: key === 'chromeSignatureValid' })
    );
    const result = spawnSync(
      process.execPath,
      [program, 'verify', policyPath, path],
      { encoding: 'utf8' }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /test evidence/);
  }
});
