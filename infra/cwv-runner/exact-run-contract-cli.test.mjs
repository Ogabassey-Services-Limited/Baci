import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createChallenge } from './exact-run-contract.mjs';
import { parseCanonicalNormalRelease } from './normal-release.mjs';

test('emits sorted canonical contract JSON with no trailing newline', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'exact-cli-'));
  const binding = {
    admissionId: 'a'.repeat(64),
    campaignId: 'campaign-1',
    expectedSha: 'b'.repeat(40),
    policyFileSha256: 'c'.repeat(64),
    repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
    run: { attempt: 1, id: 9 },
    workflow: {
      id: 3,
      job: 'attest',
      path: '.github/workflows/cwv-runner-attestation.yml',
      ref: 'refs/heads/main',
    },
  };
  const file = path.join(directory, 'binding.json');
  await writeFile(file, JSON.stringify(binding));
  const result = spawnSync(
    process.execPath,
    [
      new URL('./exact-run-contract-cli.mjs', import.meta.url).pathname,
      'create-challenge',
      file,
      'admission',
      'd'.repeat(64),
      '1',
      '30',
      '11111111-1111-4111-8111-111111111111',
    ],
    { encoding: 'utf8' }
  );
  await rm(directory, { force: true, recursive: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.endsWith('\n'), false);
  assert.equal(
    result.stdout,
    JSON.stringify(
      JSON.parse(result.stdout),
      Object.keys(JSON.parse(result.stdout)).sort()
    )
  );
});

test('accepts the preliminary seven-key binding before runner inventory exists', () => {
  const binding = {
    admissionId: 'a'.repeat(64),
    campaignId: 'campaign-1',
    expectedSha: 'b'.repeat(40),
    policyFileSha256: 'c'.repeat(64),
    repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
    run: { attempt: 1, id: 9 },
    workflow: {
      id: 3,
      job: 'attest',
      path: '.github/workflows/cwv-runner-attestation.yml',
      ref: 'refs/heads/main',
    },
  };

  assert.doesNotThrow(() =>
    createChallenge({
      binding,
      bootId: '11111111-1111-4111-8111-111111111111',
      kind: 'admission',
      nonce: 'd'.repeat(64),
      nowMonotonicSeconds: 1,
      ttlSeconds: 30,
    })
  );
});

test('creates the final nested allow only from the bound generation-one inventory receipt', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'exact-cli-allow-'));
  const binding = {
    admissionId: 'a'.repeat(64),
    campaignId: 'campaign-1',
    expectedSha: 'b'.repeat(40),
    policyFileSha256: 'c'.repeat(64),
    repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
    run: { attempt: 1, id: 9 },
    workflow: {
      id: 3,
      job: 'attest',
      path: '.github/workflows/cwv-runner-attestation.yml',
      ref: 'refs/heads/main',
    },
  };
  const receipt = {
    admissionId: binding.admissionId,
    campaignId: binding.campaignId,
    expiresMonotonicSeconds: 8,
    holdDigest: 'd'.repeat(64),
    policyFileSha256: binding.policyFileSha256,
    runner: {
      generation: 1,
      id: 99,
      name: 'baci-cwv-measurement-01',
    },
    schemaVersion: 1,
  };
  const bindingFile = path.join(directory, 'binding.json');
  const receiptFile = path.join(directory, 'receipt.json');
  await writeFile(bindingFile, JSON.stringify(binding));
  await writeFile(receiptFile, JSON.stringify(receipt));

  const result = spawnSync(
    process.execPath,
    [
      new URL('./exact-run-contract-cli.mjs', import.meta.url).pathname,
      'create-final-allow',
      bindingFile,
      receiptFile,
      '4',
    ],
    { encoding: 'utf8' }
  );

  await rm(directory, { force: true, recursive: true });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    ...binding,
    expiresMonotonicSeconds: receipt.expiresMonotonicSeconds,
    kind: 'allow',
    runner: receipt.runner,
    schemaVersion: 1,
  });
});

test('creates the canonical normal release from the verified post-start chain', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'exact-cli-normal-'));
  const binding = {
    admissionId: 'a'.repeat(64),
    campaignId: 'campaign-1',
    expectedSha: 'b'.repeat(40),
    policyFileSha256: 'c'.repeat(64),
    repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
    run: { attempt: 1, id: 9 },
    workflow: {
      id: 3,
      job: 'attest',
      path: '.github/workflows/cwv-runner-attestation.yml',
      ref: 'refs/heads/main',
    },
  };
  const receipt = {
    admissionId: binding.admissionId,
    campaignId: binding.campaignId,
    expiresMonotonicSeconds: 8,
    holdDigest: 'd'.repeat(64),
    policyFileSha256: binding.policyFileSha256,
    runner: { generation: 1, id: 99, name: 'baci-cwv-measurement-01' },
    schemaVersion: 1,
  };
  const files = Object.fromEntries(
    await Promise.all(
      Object.entries({
        binding,
        receipt,
        runtime: {
          campaignId: binding.campaignId,
          externalIfindex: 2,
          externalInterface: 'eth0',
          runnerContainerId: 'e'.repeat(64),
          runnerIp: '192.0.2.2',
          runnerPeerIfindex: 3,
          runnerVeth: 'veth0',
        },
        held: {
          campaignId: binding.campaignId,
          runnerContainerId: 'e'.repeat(64),
          runnerIp: '192.0.2.2',
          runnerPeerIfindex: 3,
          runnerVeth: 'veth0',
        },
      }).map(async ([name, value]) => {
        const file = path.join(directory, `${name}.json`);
        await writeFile(file, JSON.stringify(value));
        return [name, file];
      })
    )
  );
  for (const name of ['classifier', 'hold', 'sample']) {
    files[name] = path.join(directory, `${name}.sha256`);
    await writeFile(
      files[name],
      `${name === 'hold' ? receipt.holdDigest : name === 'classifier' ? 'f'.repeat(64) : '1'.repeat(64)}\n`
    );
  }
  const result = spawnSync(
    process.execPath,
    [
      new URL('./exact-run-contract-cli.mjs', import.meta.url).pathname,
      'create-normal-release',
      files.binding,
      files.receipt,
      files.classifier,
      files.hold,
      files.sample,
      files.runtime,
      files.held,
      '2'.repeat(64),
      '5',
      '120',
    ],
    { encoding: 'utf8' }
  );
  await rm(directory, { force: true, recursive: true });
  assert.equal(result.status, 0, result.stderr);
  const release = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(release), [
    'campaignId',
    'captureSha256',
    'classifierSha256',
    'containerId',
    'containerPrefix',
    'createdMonotonicSeconds',
    'egressIdentity',
    'expiresMonotonicSeconds',
    'liveSampleSha256',
    'peerIdentity',
    'policyFileSha256',
    'runnerIp',
    'vethIdentity',
  ]);
  assert.equal(release.egressIdentity, 'external:eth0:2');
  assert.equal(release.peerIdentity, 'veth:veth0:3');
  assert.deepEqual(
    parseCanonicalNormalRelease(
      result.stdout,
      {
        campaignId: binding.campaignId,
        captureSha256: '2'.repeat(64),
        containerPrefix: 'e'.repeat(12),
        policyFileSha256: binding.policyFileSha256,
      },
      5,
      120
    ).release,
    release
  );
});
