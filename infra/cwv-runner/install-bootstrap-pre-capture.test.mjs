import assert from 'node:assert/strict';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { beginBootstrap } from './install-bootstrap.mjs';
import { reconcileBootstrapPreCapture } from './install-bootstrap-pre-capture.mjs';

test('resumes pre-capture cleanup after a crash following its first unlink', async (context) => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'baci-pre-capture-resume-'));
  context.after(() => rm(stateRoot, { recursive: true, force: true }));
  await chmod(stateRoot, 0o700);
  const directory = join(stateRoot, 'bootstrap-aaaaaaaaaaaa');
  await mkdir(directory, { mode: 0o700 });
  const path = '/srv/baci-cwv/sealed/bootstrap.sha256';
  const capture = beginBootstrap({
    transactionId: 'bootstrap-aaaaaaaaaaaa',
    sourceSha: 'a'.repeat(40),
    sourceManifestSha256: 'b'.repeat(64),
    policyFileSha256: 'c'.repeat(64),
    prior: { [path]: { absent: true } },
    files: {
      [path]: {
        sha256: 'd'.repeat(64),
        mode: '0600',
        owner: 'root:root',
      },
    },
  });
  await writeFile(join(directory, 'capture.json'), capture.captureBytes, {
    mode: 0o600,
  });
  await writeFile(
    join(directory, 'capture.sha256'),
    `${capture.captureSha256}\n`,
    { mode: 0o600 }
  );
  await writeFile(join(directory, 'journal.ndjson'), '', { mode: 0o600 });
  let removed = 0;

  await assert.rejects(
    reconcileBootstrapPreCapture(directory, {
      async removePreCaptureFile(file) {
        await unlink(file);
        removed += 1;
        if (removed === 1) throw new Error('simulated cleanup crash');
      },
    }),
    /simulated cleanup crash/
  );
  assert.equal((await lstat(join(directory, '.pre-capture-cleanup'))).size, 0);

  await reconcileBootstrapPreCapture(directory);
  await assert.rejects(lstat(directory), { code: 'ENOENT' });
});
