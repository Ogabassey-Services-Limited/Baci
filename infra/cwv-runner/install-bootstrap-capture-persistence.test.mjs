import assert from 'node:assert/strict';
import {
  chmod,
  lstat,
  mkdtemp,
  open,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { beginBootstrap } from './install-bootstrap.mjs';
import { persistBootstrapCapture } from './install-bootstrap-capture-persistence.mjs';
import {
  captureBootstrap,
  resumeBootstrap,
} from './install-bootstrap-controller.mjs';

test('never publishes a truncated capture.json when its first write fails', async (context) => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'baci-bootstrap-partial-'));
  context.after(() => rm(stateRoot, { recursive: true, force: true }));
  await chmod(stateRoot, 0o700);
  const path = '/srv/baci-cwv/sealed/bootstrap.sha256';
  const input = {
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
  };
  const capture = beginBootstrap(input);

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

  assert.equal(await captureBootstrap(stateRoot, input), directory);
  assert.equal((await resumeBootstrap(directory, input)).phase, 'captured');
});

test('atomically publishes the digest and retries a truncated legacy digest', async (context) => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'baci-bootstrap-digest-'));
  context.after(() => rm(stateRoot, { recursive: true, force: true }));
  await chmod(stateRoot, 0o700);
  const path = '/srv/baci-cwv/sealed/bootstrap.sha256';
  const input = {
    transactionId: 'bootstrap-bbbbbbbbbbbb',
    sourceSha: 'b'.repeat(40),
    sourceManifestSha256: 'c'.repeat(64),
    policyFileSha256: 'd'.repeat(64),
    prior: { [path]: { absent: true } },
    files: {
      [path]: {
        sha256: 'e'.repeat(64),
        mode: '0600',
        owner: 'root:root',
      },
    },
  };
  const capture = beginBootstrap(input);

  await assert.rejects(
    persistBootstrapCapture(stateRoot, capture, {
      openCaptureDigestFile: async (file, flags, mode) => {
        const handle = await open(file, flags, mode);
        return {
          close: () => handle.close(),
          sync: () => handle.sync(),
          async writeFile(bytes) {
            await handle.writeFile(bytes.slice(0, 11));
            throw new Error('simulated partial digest write');
          },
        };
      },
    }),
    /simulated partial digest write/
  );
  const directory = join(stateRoot, capture.transactionId);
  await assert.rejects(lstat(join(directory, 'capture.sha256')), {
    code: 'ENOENT',
  });
  await assert.rejects(lstat(join(directory, '.capture-sha256-stage')), {
    code: 'ENOENT',
  });

  await writeFile(
    join(directory, 'capture.sha256'),
    capture.captureSha256.slice(0, 11),
    { mode: 0o600 }
  );
  assert.equal(await captureBootstrap(stateRoot, input), directory);
  assert.equal(
    await readFile(join(directory, 'capture.sha256'), 'utf8'),
    `${capture.captureSha256}\n`
  );
  assert.equal((await resumeBootstrap(directory, input)).phase, 'captured');
});

test('retries after process death leaves a truncated phase temporary', async (context) => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'baci-bootstrap-phase-'));
  context.after(() => rm(stateRoot, { recursive: true, force: true }));
  await chmod(stateRoot, 0o700);
  const path = '/srv/baci-cwv/sealed/bootstrap.sha256';
  const input = {
    transactionId: 'bootstrap-cccccccccccc',
    sourceSha: 'c'.repeat(40),
    sourceManifestSha256: 'd'.repeat(64),
    policyFileSha256: 'e'.repeat(64),
    prior: { [path]: { absent: true } },
    files: {
      [path]: {
        sha256: 'f'.repeat(64),
        mode: '0600',
        owner: 'root:root',
      },
    },
  };
  const capture = beginBootstrap(input);

  await assert.rejects(
    persistBootstrapCapture(stateRoot, capture, {
      async renamePhaseFile(temporary) {
        await writeFile(temporary, 'capt');
        throw new Error('simulated process death during phase publication');
      },
    }),
    /simulated process death during phase publication/
  );

  const directory = join(stateRoot, capture.transactionId);
  assert.equal(
    await readFile(join(directory, `.phase-${process.pid}`), 'utf8'),
    'capt'
  );
  await writeFile(join(directory, `.phase-${process.pid}`), 'captX');
  await assert.rejects(captureBootstrap(stateRoot, input), {
    name: 'TypeError',
    message: 'invalid pre-capture bootstrap transaction',
  });
  await writeFile(join(directory, `.phase-${process.pid}`), 'capt');
  assert.equal(await captureBootstrap(stateRoot, input), directory);
  assert.equal((await resumeBootstrap(directory, input)).phase, 'captured');
});
