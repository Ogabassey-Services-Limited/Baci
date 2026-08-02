import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  lstat,
  mkdtemp,
  open,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { replaceBootstrapFile } from './install-bootstrap-replacement-file.mjs';
import { exchangeTestPaths } from './install-bootstrap-replacement-file.test-helper.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const metadata = (bytes) => ({
  sha256: sha256(bytes),
  mode: '0600',
  owner: 'root:root',
});

test('preserves a concurrent writer that replaces the destination after exchange', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-rollback-race-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'bootstrap.sha256');
  const attacker = join(root, 'attacker');
  const priorBytes = Buffer.from('prior\n');
  const expectedBytes = Buffer.from('expected\n');
  const attackerBytes = Buffer.from('concurrent writer\n');
  await writeFile(destination, priorBytes, { mode: 0o600 });
  await writeFile(attacker, attackerBytes, { mode: 0o600 });
  const state = {
    phase: 'captured',
    sourceSha: 'b'.repeat(40),
    captureSha256: '3'.repeat(64),
    policyFileSha256: '5'.repeat(64),
    prior: { [destination]: metadata(priorBytes) },
    files: { [destination]: metadata(expectedBytes) },
  };
  const intent = {
    sourceSha: state.sourceSha,
    captureSha256: state.captureSha256,
    policyFileSha256: state.policyFileSha256,
    pathSetSha256: sha256(JSON.stringify([destination])),
    transitionPaths: [destination],
  };
  let projectionCalls = 0;
  let exchangeCalls = 0;
  await assert.rejects(
    replaceBootstrapFile(
      {
        currentDirectory: '/state/current',
        destination,
        bytes: expectedBytes,
      },
      {
        readState: async () => state,
        readIntent: async () => intent,
        chownFile: async () => undefined,
        exchangeFile: async (left, right) => {
          exchangeCalls += 1;
          await exchangeTestPaths(left, right);
        },
        readProjection: async (files) => {
          projectionCalls += 1;
          if (projectionCalls === 2) await rename(attacker, destination);
          const result = {};
          for (const path of Object.keys(files))
            result[path] = metadata(await readFile(path));
          return result;
        },
      }
    ),
    /installed bootstrap replacement drift/
  );
  assert.equal(exchangeCalls, 1);
  assert.deepEqual(await readFile(destination), attackerBytes);
  const [temporary] = (await readdir(root)).filter((entry) =>
    entry.startsWith('.baci-bootstrap-replacement-')
  );
  assert.deepEqual(await readFile(join(root, temporary)), priorBytes);
});

test('preserves a concurrent in-place write before rollback', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-rollback-write-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'bootstrap.sha256');
  const priorBytes = Buffer.from('prior\n');
  const expectedBytes = Buffer.from('expected\n');
  const attackerBytes = Buffer.from('same inode concurrent writer\n');
  await writeFile(destination, priorBytes, { mode: 0o600 });
  const state = {
    phase: 'captured',
    sourceSha: 'b'.repeat(40),
    captureSha256: '3'.repeat(64),
    policyFileSha256: '5'.repeat(64),
    prior: { [destination]: metadata(priorBytes) },
    files: { [destination]: metadata(expectedBytes) },
  };
  const intent = {
    sourceSha: state.sourceSha,
    captureSha256: state.captureSha256,
    policyFileSha256: state.policyFileSha256,
    pathSetSha256: sha256(JSON.stringify([destination])),
    transitionPaths: [destination],
  };
  let exchangeCalls = 0;
  let changedDestination = false;
  await assert.rejects(
    replaceBootstrapFile(
      {
        currentDirectory: '/state/current',
        destination,
        bytes: expectedBytes,
      },
      {
        readState: async () => state,
        readIntent: async () => intent,
        chownFile: async () => undefined,
        readProjection: async (files) => {
          const result = {};
          for (const path of Object.keys(files))
            result[path] = metadata(await readFile(path));
          return result;
        },
        exchangeFile: async (left, right) => {
          exchangeCalls += 1;
          await exchangeTestPaths(left, right);
          if (exchangeCalls === 1) await writeFile(left, 'damaged prior\n');
        },
        readIdentity: async (path) => {
          if (
            exchangeCalls > 0 &&
            path === destination &&
            !changedDestination
          ) {
            changedDestination = true;
            await writeFile(path, attackerBytes);
          }
          return lstat(path);
        },
      }
    ),
    /installed bootstrap replacement drift/
  );
  assert.equal(exchangeCalls, 1);
  assert.deepEqual(await readFile(destination), attackerBytes);
});

test('does not roll back a prior inode changed through a retained descriptor', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-rollback-prior-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'bootstrap.sha256');
  const priorBytes = Buffer.from('prior\n');
  const expectedBytes = Buffer.from('expected\n');
  const attackerBytes = Buffer.from('retained descriptor writer\n');
  await writeFile(destination, priorBytes, { mode: 0o600 });
  const retained = await open(destination, 'r+');
  context.after(() => retained.close());
  const state = {
    phase: 'captured',
    sourceSha: 'b'.repeat(40),
    captureSha256: '3'.repeat(64),
    policyFileSha256: '5'.repeat(64),
    prior: { [destination]: metadata(priorBytes) },
    files: { [destination]: metadata(expectedBytes) },
  };
  const intent = {
    sourceSha: state.sourceSha,
    captureSha256: state.captureSha256,
    policyFileSha256: state.policyFileSha256,
    pathSetSha256: sha256(JSON.stringify([destination])),
    transitionPaths: [destination],
  };
  let exchangeCalls = 0;
  let changedPrior = false;
  await assert.rejects(
    replaceBootstrapFile(
      {
        currentDirectory: '/state/current',
        destination,
        bytes: expectedBytes,
      },
      {
        readState: async () => state,
        readIntent: async () => intent,
        chownFile: async () => undefined,
        readProjection: async (files) => {
          if (Object.keys(files).length === 2 && !changedPrior) {
            changedPrior = true;
            await retained.writeFile(attackerBytes);
          }
          const result = {};
          for (const path of Object.keys(files))
            result[path] = metadata(await readFile(path));
          return result;
        },
        exchangeFile: async (left, right) => {
          exchangeCalls += 1;
          await exchangeTestPaths(left, right);
        },
      }
    ),
    /installed bootstrap replacement drift/
  );
  assert.equal(exchangeCalls, 1);
  assert.deepEqual(await readFile(destination), expectedBytes);
  const [temporary] = (await readdir(root)).filter((entry) =>
    entry.startsWith('.baci-bootstrap-replacement-')
  );
  assert.deepEqual(await readFile(join(root, temporary)), attackerBytes);
});
