import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import * as sourceAuthorization from './task9-source-authorization.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) =>
  `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${JSON.stringify(value[key])}`)
    .join(',')}}`;
const artifactDownload = {
  allowedQueryKeys:
    'rscd|rsct|se|sig|ske|skoid|sks|skt|sktid|skv|sp|spr|sr|st|sv',
  bodyInactivityTimeoutSeconds: 10,
  connectTimeoutSeconds: 10,
  headerTimeoutSeconds: 10,
  hostPattern: '^productionresultssa[0-9]+\\.blob\\.core\\.windows\\.net$',
  maxBytes: 1_048_576,
  overallTimeoutSeconds: 30,
  pathPrefix: '/actions-results/',
};
function installPolicy(sourceRoot, value = artifactDownload) {
  const path = join(sourceRoot, 'infra/cwv-runner/policy.json');
  mkdirSync(join(sourceRoot, 'infra/cwv-runner'), { recursive: true });
  const bytes = Buffer.from(
    JSON.stringify({ repositoryAuthority: { artifactDownload: value } })
  );
  writeFileSync(path, bytes, { mode: 0o400 });
  return { bytes, path, sha256: hash(bytes) };
}
function transportFixture(root) {
  const sourceRoot = join(root, 'authorized-source');
  const relativePath = 'infra/cwv-runner/owner-api-transport-runtime.mjs';
  const member = join(sourceRoot, relativePath);
  mkdirSync(join(sourceRoot, 'infra/cwv-runner'), { recursive: true });
  const runtime = Buffer.from(
    'export function runTransportCli(_args,{transportPolicy}){return transportPolicy;}\n'
  );
  writeFileSync(member, runtime, { mode: 0o400 });
  const authorizationPath = join(root, 'source-authorization.json');
  const authorizationSha256Path = join(root, 'source-authorization.sha256');
  const writeReceipt = (policyFileSha256) => {
    const receipt = Buffer.from(
      canonical({
        policyFileSha256,
        purpose: 'task9-exact-run',
        sourceFiles: [{ path: relativePath, sha256: hash(runtime) }],
      })
    );
    writeFileSync(authorizationPath, receipt);
    writeFileSync(authorizationSha256Path, `${hash(receipt)}\n`);
  };
  return {
    input: { authorizationPath, authorizationSha256Path, sourceRoot },
    sourceRoot,
    writeReceipt,
  };
}

test('fails closed for absent, symlinked, hash-drifted, or schema-drifted policy bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'task9-policy-source-'));
  try {
    const fixture = transportFixture(root);
    fixture.writeReceipt('a'.repeat(64));
    assert.throws(
      () => sourceAuthorization.verifyTask9Source(fixture.input),
      /refused/
    );

    const external = join(root, 'external-policy.json');
    const validBytes = Buffer.from(
      JSON.stringify({ repositoryAuthority: { artifactDownload } })
    );
    writeFileSync(external, validBytes);
    symlinkSync(
      external,
      join(fixture.sourceRoot, 'infra/cwv-runner/policy.json')
    );
    fixture.writeReceipt(hash(validBytes));
    assert.throws(
      () => sourceAuthorization.verifyTask9Source(fixture.input),
      /refused/
    );

    rmSync(join(fixture.sourceRoot, 'infra/cwv-runner/policy.json'));
    const policy = installPolicy(fixture.sourceRoot);
    fixture.writeReceipt('b'.repeat(64));
    assert.throws(
      () => sourceAuthorization.verifyTask9Source(fixture.input),
      /refused/
    );

    rmSync(policy.path);
    writeFileSync(
      policy.path,
      JSON.stringify({
        repositoryAuthority: {
          artifactDownload: { ...artifactDownload, maxBytes: 1_048_577 },
        },
      })
    );
    fixture.writeReceipt(hash(readFileSync(policy.path)));
    assert.throws(
      () => sourceAuthorization.verifyTask9Source(fixture.input),
      /refused/
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('holds policy identity and passes only its exact sealed projection to transport', async () => {
  const root = mkdtempSync(join(tmpdir(), 'task9-policy-projection-'));
  try {
    const fixture = transportFixture(root);
    const policy = installPolicy(fixture.sourceRoot);
    fixture.writeReceipt(policy.sha256);
    sourceAuthorization.withVerifiedTask9Source(
      fixture.input,
      (_receipt, _read, _descriptors, assertHeld, sealed) => {
        assert.deepEqual(
          sealed.policy.allowedQueryKeys,
          artifactDownload.allowedQueryKeys.split('|')
        );
        assert.equal(sealed.policy.pathPrefix, artifactDownload.pathPrefix);
        renameSync(policy.path, `${policy.path}.held`);
        writeFileSync(policy.path, policy.bytes, { mode: 0o400 });
        assert.throws(assertHeld, /refused/);
      }
    );
    rmSync(policy.path);
    renameSync(`${policy.path}.held`, policy.path);
    const sealed = await sourceAuthorization.runVerifiedTask9Transport(
      fixture.input,
      ['exact-operation']
    );
    assert.equal(sealed.policyFileSha256, policy.sha256);
    assert.deepEqual(sealed.policy.timeoutsMs, {
      bodyInactivity: 10_000,
      connect: 10_000,
      headers: 10_000,
      overall: 30_000,
    });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
