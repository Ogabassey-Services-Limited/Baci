import assert from 'node:assert/strict';
import { lstat, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { publishBootstrapPlan } from './install-bootstrap-plan-publication.mjs';

const input = {
  transactionId: 'bootstrap-bbbbbbbbbbbb',
  sourceSha: 'b'.repeat(40),
  sourceManifestSha256: 'c'.repeat(64),
  policyFileSha256: 'd'.repeat(64),
  files: {
    '/srv/baci-cwv/sealed/bootstrap.sha256': {
      sha256: 'e'.repeat(64),
      mode: '0600',
      owner: 'root:root',
    },
  },
  prior: { '/srv/baci-cwv/sealed/bootstrap.sha256': { absent: true } },
};
const bytes = Buffer.from(`${JSON.stringify(input)}\n`);

test('a crash while writing leaves no visible legacy plan', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-plan-publication-'));
  context.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(
    publishBootstrapPlan(root, bytes, {
      writeTemporary: async (handle) => {
        await handle.write(bytes.subarray(0, 19));
        throw new Error('simulated crash during plan write');
      },
    }),
    /simulated crash/
  );

  assert.equal(
    (await readdir(root)).some((name) => name.startsWith('.plan.')),
    false
  );
  assert.equal(
    (await readdir(root)).some((name) =>
      name.startsWith('.bootstrap-plan-stage.')
    ),
    false
  );
});

test('reconciles an unpublished staging file left before the hard link', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-plan-publication-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const stale = join(root, `.bootstrap-plan-stage.${'a'.repeat(32)}`);
  await writeFile(stale, bytes.subarray(0, 19), { mode: 0o600 });

  const plan = await publishBootstrapPlan(root, bytes);

  assert.deepEqual(await readdir(root), [plan.split('/').at(-1)]);
});

test('publishes canonical bytes atomically after synchronizing the staging file', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-plan-publication-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const events = [];

  const plan = await publishBootstrapPlan(root, bytes, {
    onEvent: (event) => events.push(event),
  });

  assert.match(plan, /\/\.plan\.[0-9a-f]{32}$/);
  assert.deepEqual(events, [
    'write',
    'file-sync',
    'link',
    'unlink',
    'dir-sync',
  ]);
  assert.equal((await lstat(plan)).mode & 0o777, 0o600);
  assert.deepEqual(await readdir(root), [plan.split('/').at(-1)]);
});
