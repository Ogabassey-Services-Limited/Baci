import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSyntheticRootfs } from './install-prepare-synthetic.mjs';

test('creates one deterministic ustar rootfs containing only a static probe', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-cwv-synthetic-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const first = join(directory, 'first.tar');
  const second = join(directory, 'second.tar');

  const [one, two] = await Promise.all([
    createSyntheticRootfs(first),
    createSyntheticRootfs(second),
  ]);

  assert.deepEqual(one, two);
  assert.deepEqual(Object.keys(one).sort(), [
    'archiveSha256',
    'entrypoint',
    'platform',
    'schemaVersion',
    'size',
  ]);
  assert.equal(one.entrypoint, '/probe');
  assert.equal(one.platform, 'linux/amd64');
  assert.equal(one.size, 2048);
  assert.deepEqual(await readFile(first), await readFile(second));
  const archive = await readFile(first);
  assert.equal(
    archive.subarray(0, 100).toString('utf8').replaceAll('\0', ''),
    'probe'
  );
  assert.equal(archive.subarray(100, 108).toString('ascii'), '0000755\0');
  assert.equal(archive.subarray(257, 263).toString('ascii'), 'ustar\0');
  assert.deepEqual(
    archive.subarray(512, 516),
    Buffer.from([0x7f, 0x45, 0x4c, 0x46])
  );
  assert.ok(archive.subarray(1024).every((byte) => byte === 0));
});

test('refuses an existing output instead of replacing transaction bytes', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-cwv-synthetic-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, 'rootfs.tar');
  await createSyntheticRootfs(output);
  await assert.rejects(createSyntheticRootfs(output), /exists/);
});
