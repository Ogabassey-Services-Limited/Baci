import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { stageRunnerRuntimeReceipt } from './install-prepare-acceptance.fixture.mjs';
import { readRunnerRuntimeReceipt } from './runner-runtime-manifest-receipt-reader.mjs';

test('accepts the durable root image receipt only at its explicit 0600 mode', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'cwv-runtime-reader-'));
  context.after(async () => {
    for (const path of [
      join(root, 'runner-runtime-projection/bin'),
      join(root, 'runner-runtime-projection'),
    ])
      await chmod(path, 0o755).catch(() => undefined);
    await rm(root, { force: true, recursive: true });
  });
  await stageRunnerRuntimeReceipt(root);
  const imageReceipt = join(root, 'runner-runtime-image-receipt.json');
  await chmod(imageReceipt, 0o600);
  const owner = { gid: process.getgid(), uid: process.getuid() };

  assert.equal(
    readRunnerRuntimeReceipt(
      join(root, 'runner-runtime'),
      imageReceipt,
      owner,
      0o600
    ).context.imageId.startsWith('sha256:'),
    true
  );
  assert.throws(() =>
    readRunnerRuntimeReceipt(join(root, 'runner-runtime'), imageReceipt, owner)
  );
});
