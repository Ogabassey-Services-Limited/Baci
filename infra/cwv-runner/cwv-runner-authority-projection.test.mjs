// biome-ignore-all format: closed source projection assertion stays compact
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { archiveIdentity } from './build-image.mjs';
import { sealedPaths } from './image-process-map.mjs';
import { archiveFixture } from './image-projection.fixture.mjs';
import { policyBytes, sha256 } from './image-projection-receipts.fixture.mjs';

const root = new URL('./', import.meta.url);
const dockerfile = readFileSync(new URL('Dockerfile', root), 'utf8');
const archiveAuthority = readFileSync(
  new URL('image-archive-authority.mjs', root),
  'utf8'
);

const authorityModules = [
  'canonical-json.mjs',
  'cwv-runner-authority.mjs',
  'cwv-runner-authority-core.mjs',
  'cwv-runner-authority-filters.mjs',
  'cwv-runner-authority-runtime.mjs',
  'cwv-runner-stable-attestation-builder.mjs',
  'policy.schema.mjs',
];
const runtimeSources = [
  'command-settings-contract.mjs',
  'container-attest-runtime.mjs',
  ...authorityModules,
  'direct-listener-conformance.mjs',
  'entrypoint-runtime.mjs',
  'entrypoint.mjs',
  'entrypoint.sh',
  'isolation-probe.sh',
  'normal-release.mjs',
  'policy.json',
  'process-inventory.mjs',
  'registration-egress-probe.mjs',
  'registration-release.mjs',
  'runner-identity-gate.mjs',
  'sealed-runner.mjs',
];

test('projects exact byte-identical authority sources from this checkout canonical authority', () => {
  const canonical = new URL('../../.github/scripts/', root);
  for (const name of authorityModules)
    assert.deepEqual(
      readFileSync(new URL(name, root)),
      readFileSync(new URL(name, canonical)),
      name
    );
});

test('keeps every sealed authority source byte-stable under Biome formatting', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cwv-authority-biome-'));
  try {
    for (const name of authorityModules) {
      const source = join(directory, name);
      writeFileSync(source, readFileSync(new URL(name, root)));
      const result = spawnSync(
        'pnpm',
        ['exec', 'biome', 'format', '--write', source],
        { cwd: fileURLToPath(new URL('../../', root)), encoding: 'utf8' }
      );
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(readFileSync(source), readFileSync(new URL(name, root)));
    }
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test('projects the complete authority and runner-identity closure as sealed source-bound runtime modules', () => {
  for (const name of [...authorityModules, 'runner-identity-gate.mjs']) {
    assert.ok(sealedPaths.includes(`/opt/baci-cwv/${name}`), name);
    assert.match(dockerfile, new RegExp(`COPY[^\\n]*${name}[^\\n]*\\/opt\\/baci-cwv\\/`));
    assert.match(dockerfile, new RegExp(`baci_paths=\\([^)]*${name}`, 's'));
    assert.match(archiveAuthority, new RegExp(`'${name}'`));
  }
});

test('binds every authority module through the final rootfs, process receipt, and source archive', () => {
  const fixture = archiveFixture();
  const source = () => ({
    sha256: fixture.sourceSha,
    sourceArchive: {
      entries: runtimeSources.map((name) => ({
        blobSha256: sha256(name === 'policy.json' ? policyBytes : 'sealed'),
        mode: '100644',
        path: `infra/cwv-runner/${name}`,
      })),
    },
  });
  const identity = archiveIdentity(fixture.archive, source());
  for (const name of authorityModules) {
    const entry = identity.processMap.sealed.find(
      ({ path }) => path === `/opt/baci-cwv/${name}`
    );
    assert.deepEqual(entry, {
      mode: '0555',
      owner: '0:0',
      path: `/opt/baci-cwv/${name}`,
      realpath: `/opt/baci-cwv/${name}`,
      sha256: sha256('sealed'),
    });
    const drift = source();
    drift.sourceArchive.entries.find(({ path }) => path.endsWith(name)).blobSha256 =
      '0'.repeat(64);
    assert.throws(
      () => archiveIdentity(fixture.archive, drift),
      /runtime source byte drift/
    );
  }
});
