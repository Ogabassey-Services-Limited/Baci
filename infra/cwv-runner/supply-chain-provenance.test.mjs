import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalJson } from './canonical-json.mjs';
// biome-ignore format: compact colocated imports preserve the 300-line test gate.
import { fetchSemanticMetadata, verifySupplyChainProvenance } from './supply-chain-provenance.mjs';

// biome-ignore format: compact shared fixture loader preserves the line gate.
const loadPolicy = () => JSON.parse(readFileSync(new URL('policy.json', import.meta.url), 'utf8'));
const semanticLimits = { resolver: async () => ['8.8.8.8'] };
const responseAt = (options, response) => ({
  ...response,
  remoteAddress: options.address,
});
const baseInputs = (policy) => {
  const runner = policy.supplyChainProvenance.runner;
  return {
    runnerReleaseValue: {
      assets: [
        {
          id: runner.assetId,
          name: runner.assetName,
          size: runner.assetSize,
          digest: runner.assetDigest,
        },
      ],
    },
    pnpmMetadataValue: {
      version: policy.supplyChain.pnpm.version,
      dist: {
        tarball: policy.supplyChain.pnpm.url,
        integrity: policy.supplyChain.pnpm.integrity,
        shasum: policy.supplyChainProvenance.pnpm.distShasum,
      },
    },
  };
};
test('provenance selects exact runner asset and pnpm metadata', () => {
  const policy = loadPolicy();
  const dir = mkdtempSync(join(tmpdir(), 'cwv-provenance-'));
  const runnerRelease = join(dir, 'runner.json');
  const pnpmMetadata = join(dir, 'pnpm.json');
  writeFileSync(
    runnerRelease,
    JSON.stringify({
      assets: [
        {
          id: policy.supplyChainProvenance.runner.assetId,
          name: policy.supplyChainProvenance.runner.assetName,
          size: policy.supplyChainProvenance.runner.assetSize,
          digest: policy.supplyChainProvenance.runner.assetDigest,
        },
      ],
    })
  );
  writeFileSync(
    pnpmMetadata,
    JSON.stringify({
      version: policy.supplyChain.pnpm.version,
      dist: {
        tarball: policy.supplyChain.pnpm.url,
        integrity: policy.supplyChain.pnpm.integrity,
        shasum: policy.supplyChainProvenance.pnpm.distShasum,
      },
    })
  );
  assert.deepEqual(
    verifySupplyChainProvenance(policy, { runnerRelease, pnpmMetadata }),
    {
      pnpm: true,
      runner: true,
    }
  );
});
test('rejects a node receipt whose executable digest differs from extracted Node bytes', () => {
  const [policy, baseToolReceipt, nodeExecutable, baseToolBytes] = (() => {
    const policy = loadPolicy();
    const directory = mkdtempSync(join(tmpdir(), 'cwv-node-provenance-'));
    // biome-ignore format: compact tuple keeps the focused test under its line gate.
    return [policy, join(directory, 'base-tools.json'), join(directory, 'node'), canonicalJson({ schemaVersion: 1 })];
  })();
  writeFileSync(baseToolReceipt, baseToolBytes);
  writeFileSync(nodeExecutable, 'actual node bytes');
  // biome-ignore format: the Node receipt contains the exact frozen provenance tuple.
  const nodeReceiptValue = { archiveBasename: new URL(policy.supplyChain.node.url).pathname.split('/').at(-1), archiveSha256: policy.supplyChain.node.sha256, baseToolReceiptSha256: createHash('sha256').update(baseToolBytes).digest('hex'), checksumsSha256: policy.supplyChainProvenance.node.checksumsSha256, executableSha256: 'a'.repeat(64), keyringSha256: policy.supplyChainProvenance.node.keyringSha256, schemaVersion: 1, signatureSha256: policy.supplyChainProvenance.node.signatureSha256 };
  // biome-ignore format: one provenance verification is the complete regression assertion.
  assert.throws(() => verifySupplyChainProvenance(policy, { ...baseInputs(policy), baseToolReceipt, nodeExecutable, nodeReceiptValue }), /node executable/);
});
test('provenance passes the frozen runner version into the CommandSettings receipt contract', () => {
  const source = readFileSync(
    new URL('supply-chain-provenance.mjs', import.meta.url),
    'utf8'
  );
  assert.match(
    source,
    /runnerArchiveSha256: runner\.sha256,\s*runnerVersion: runner\.version/
  );
});
test('semantic metadata fetch is bounded to policy URLs and origins', async () => {
  const policy = loadPolicy();
  const runner = policy.supplyChainProvenance.runner;
  const pnpm = policy.supplyChainProvenance.pnpm;
  const requests = [];
  const responses = new Map([
    [
      runner.releaseApiUrl,
      {
        status: 302,
        headers: { location: `${runner.releaseApiUrl}/final` },
        body: '',
      },
    ],
    [
      `${runner.releaseApiUrl}/final`,
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: '{"assets":[]}',
      },
    ],
    [
      pnpm.metadataUrl,
      {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: '{"version":"11.7.0"}',
      },
    ],
  ]);
  const result = await fetchSemanticMetadata(
    policy,
    (url, options) => {
      requests.push([url, options]);
      return responseAt(options, responses.get(url));
    },
    semanticLimits
  );
  assert.deepEqual(result, {
    pnpm: { version: '11.7.0' },
    runner: { assets: [] },
  });
  assert.equal(requests.length, 3);
  assert.ok(
    requests.every(
      ([, options]) =>
        options.rejectUnauthorized === true &&
        options.credentials === false &&
        options.connectTimeoutMs === 10_000 &&
        options.headerTimeoutMs === 10_000 &&
        options.bodyInactivityTimeoutMs === 10_000
    )
  );
});
test('semantic metadata rejects wrong content type and oversized bodies', async () => {
  const policy = loadPolicy();
  await assert.rejects(
    fetchSemanticMetadata(
      policy,
      (_url, options) =>
        responseAt(options, {
          status: 200,
          headers: { 'content-type': 'text/plain' },
          body: '{}',
        }),
      semanticLimits
    ),
    /content type/
  );
  await assert.rejects(
    fetchSemanticMetadata(
      policy,
      (_url, options) =>
        responseAt(options, {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: 'x'.repeat(1_048_577),
        }),
      semanticLimits
    ),
    /too large/
  );
});
test('semantic metadata validates redirect targets before contact', async () => {
  const policy = loadPolicy();
  const runnerUrl = policy.supplyChainProvenance.runner.releaseApiUrl;
  const pnpmUrl = policy.supplyChainProvenance.pnpm.metadataUrl;
  const contacted = [];
  await assert.rejects(
    fetchSemanticMetadata(
      policy,
      (url, options) => {
        contacted.push(url);
        if (url === runnerUrl)
          return responseAt(options, {
            body: '',
            headers: { location: 'https://unapproved.test/then-back' },
            status: 302,
          });
        return responseAt(options, {
          body: '{}',
          headers: { 'content-type': 'application/json' },
          status: 200,
        });
      },
      semanticLimits
    ),
    /origin refused/
  );
  assert.deepEqual(contacted.sort(), [pnpmUrl, runnerUrl].sort());
});
test('semantic metadata refuses redirect loops and credentials', async () => {
  const policy = loadPolicy();
  const runnerUrl = policy.supplyChainProvenance.runner.releaseApiUrl;
  await assert.rejects(
    fetchSemanticMetadata(
      policy,
      (url, options) =>
        responseAt(options, {
          body: '',
          headers: { location: url },
          status: 302,
        }),
      semanticLimits
    ),
    /redirect loop/
  );
  await assert.rejects(
    fetchSemanticMetadata(
      policy,
      (url, options) =>
        responseAt(options, {
          body: '',
          headers: {
            location:
              url === runnerUrl
                ? 'https://user:pass@api.github.com/secret'
                : 'https://user:pass@registry.npmjs.org/secret',
          },
          status: 302,
        }),
      semanticLimits
    ),
    /origin refused/
  );
});
test('semantic metadata enforces one overall timeout', async () => {
  const policy = loadPolicy();
  const aborted = [];
  await assert.rejects(
    fetchSemanticMetadata(
      policy,
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            aborted.push(true);
            reject(new TypeError('aborted'));
          });
        }),
      { ...semanticLimits, overallTimeoutMs: 20 }
    ),
    /timeout/
  );
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(aborted.length, 2);
});
test('provenance rejects duplicate runner assets', () => {
  const policy = loadPolicy();
  assert.throws(
    () =>
      verifySupplyChainProvenance(policy, {
        runnerReleaseValue: {
          assets: [
            { id: policy.supplyChainProvenance.runner.assetId },
            { id: policy.supplyChainProvenance.runner.assetId },
          ],
        },
        pnpmMetadataValue: {},
      }),
    /runner asset/
  );
});
test('owner CLI provenance requires archive and extracted binary bytes', () => {
  const policy = loadPolicy();
  const ownerName = new URL(
    policy.supplyChainProvenance.ownerCli.archiveUrl
  ).pathname
    .split('/')
    .at(-1);
  assert.throws(
    () =>
      verifySupplyChainProvenance(policy, {
        ...baseInputs(policy),
        ownerChecksumsValue: `${policy.supplyChainProvenance.ownerCli.archiveSha256}  ${ownerName}\n`,
      }),
    /owner CLI archive/
  );
});
