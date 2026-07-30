import assert from 'node:assert/strict';
import { chmod, lstat, mkdtemp, open, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { beginBootstrap } from './install-bootstrap.mjs';
import { persistBootstrapCapture } from './install-bootstrap-capture-persistence.mjs';

test('never publishes a truncated capture.json when its first write fails', async (context) => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'baci-bootstrap-partial-'));
  context.after(() => rm(stateRoot, { recursive: true, force: true }));
  await chmod(stateRoot, 0o700);
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

  await assert.rejects(
    persistBootstrapCapture(stateRoot, capture, {
      openCaptureFile: async (file, flags, mode) => {
        const handle = await open(file, flags, mode);
        return {
          close: () => handle.close(),
          sync: () => handle.sync(),
          async writeFile(bytes) {
            await handle.writeFile(bytes.slice(0, 7));
            throw new Error('simulated partial capture write');
          },
        };
      },
    }),
    /simulated partial capture write/
  );
  const directory = join(stateRoot, capture.transactionId);
  await assert.rejects(lstat(join(directory, 'capture.json')), {
    code: 'ENOENT',
  });
  assert.deepEqual(await readdir(directory), []);
});
