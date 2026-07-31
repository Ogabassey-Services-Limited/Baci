import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  link,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { replaceBootstrapFile } from './install-bootstrap-replacement-file.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('uses the sealed Essential Perl exchange helper on Linux x64 only', async () => {
  const source = await readFile(
    new URL('./install-bootstrap-replacement-file.mjs', import.meta.url),
    'utf8'
  );
  assert.match(
    source,
    /install-bootstrap-rename-exchange\.pl[\s\S]+platform !== 'linux' \|\| architecture !== 'x64'[\s\S]+'\/usr\/bin\/perl', \[renameExchangeHelper, left, right\][\s\S]+env: \{\}[\s\S]+timeout: 5000/
  );
});

test('fails closed when the Linux exchange primitive is missing or unsupported', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-exchange-gate-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'bootstrap.sha256');
  const oldBytes = Buffer.from('old\n');
  const newBytes = Buffer.from('new\n');
  const metadata = (bytes) => ({
    sha256: sha256(bytes),
    mode: '0600',
    owner: 'root:root',
  });
  const state = {
    phase: 'captured',
    sourceSha: 'b'.repeat(40),
    captureSha256: '3'.repeat(64),
    policyFileSha256: '5'.repeat(64),
    prior: { [destination]: metadata(oldBytes) },
    files: { [destination]: metadata(newBytes) },
  };
  const intent = {
    sourceSha: state.sourceSha,
    captureSha256: state.captureSha256,
    policyFileSha256: state.policyFileSha256,
    pathSetSha256: sha256(JSON.stringify([destination])),
    transitionPaths: [destination],
  };
  const projection = async (files) => {
    const result = {};
    for (const path of Object.keys(files))
      result[path] = metadata(await readFile(path));
    return result;
  };
  await writeFile(destination, oldBytes, { mode: 0o600 });
  let executed = false;
  await assert.rejects(
    replaceBootstrapFile(
      { currentDirectory: '/state/current', destination, bytes: newBytes },
      {
        readState: async () => state,
        readIntent: async () => intent,
        readProjection: projection,
        chownFile: async () => undefined,
        exchangePlatform: 'linux',
        exchangeArchitecture: 'arm64',
        executeExchange: () => {
          executed = true;
        },
      }
    ),
    /atomic replacement primitive unavailable/
  );
  assert.equal(executed, false);
  assert.deepEqual(await readFile(destination), oldBytes);
  for (const code of ['ENOENT', 69]) {
    await writeFile(destination, oldBytes, { mode: 0o600 });
    const unavailable = Object.assign(new Error('exchange unavailable'), {
      code,
    });
    await assert.rejects(
      replaceBootstrapFile(
        { currentDirectory: '/state/current', destination, bytes: newBytes },
        {
          readState: async () => state,
          readIntent: async () => intent,
          readProjection: projection,
          chownFile: async () => undefined,
          exchangePlatform: 'linux',
          exchangeArchitecture: 'x64',
          executeExchange: () => Promise.reject(unavailable),
        }
      ),
      (error) => error === unavailable
    );
    assert.deepEqual(await readFile(destination), oldBytes);
    assert.deepEqual(await readdir(root), ['bootstrap.sha256']);
  }
});

test('refuses to publish over a destination inode swapped after prior projection', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-publication-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'bootstrap.sha256');
  const displaced = join(root, 'displaced');
  const swapped = join(root, 'swapped');
  const oldBytes = Buffer.from('old\n');
  const newBytes = Buffer.from('new\n');
  const attackerBytes = Buffer.from('attacker\n');
  await writeFile(destination, oldBytes, { mode: 0o600 });
  await writeFile(swapped, attackerBytes, { mode: 0o600 });
  const metadata = (bytes) => ({
    sha256: sha256(bytes),
    mode: '0600',
    owner: 'root:root',
  });
  const state = {
    phase: 'captured',
    sourceSha: 'b'.repeat(40),
    captureSha256: '3'.repeat(64),
    policyFileSha256: '5'.repeat(64),
    prior: { [destination]: metadata(oldBytes) },
    files: { [destination]: metadata(newBytes) },
  };
  const intent = {
    sourceSha: state.sourceSha,
    captureSha256: state.captureSha256,
    policyFileSha256: state.policyFileSha256,
    pathSetSha256: sha256(JSON.stringify([destination])),
    transitionPaths: [destination],
  };
  let exchanges = 0;
  await assert.rejects(
    replaceBootstrapFile(
      { currentDirectory: '/state/current', destination, bytes: newBytes },
      {
        readState: async () => state,
        readIntent: async () => intent,
        readProjection: async (files) => {
          const [path] = Object.keys(files);
          const bytes = await readFile(path);
          return {
            [path]: metadata(bytes),
          };
        },
        exchangeFile: async (left, right) => {
          exchanges += 1;
          if (exchanges === 1) {
            await rename(destination, displaced);
            await rename(swapped, destination);
          }
          const scratch = `${left}.exchange`;
          await rename(left, scratch);
          await rename(right, left);
          await rename(scratch, right);
        },
        chownFile: async () => undefined,
      }
    ),
    /installed bootstrap replacement drift/
  );
  assert.deepEqual(await readFile(destination), attackerBytes);
  assert.deepEqual(await readFile(displaced), oldBytes);
  const [rollbackTemporary] = (await readdir(root)).filter((entry) =>
    entry.startsWith('.baci-bootstrap-replacement-')
  );
  assert.deepEqual(await readFile(join(root, rollbackTemporary)), newBytes);
});

test('does not clobber a concurrent creator during an authorized absent install', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-absent-publish-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'watchdog.service');
  const newBytes = Buffer.from('new watchdog\n');
  const attackerBytes = Buffer.from('attacker\n');
  const expected = {
    sha256: sha256(newBytes),
    mode: '0600',
    owner: 'root:root',
  };
  const state = {
    phase: 'captured',
    sourceSha: 'b'.repeat(40),
    captureSha256: '3'.repeat(64),
    policyFileSha256: '5'.repeat(64),
    prior: { [destination]: { absent: true } },
    files: { [destination]: expected },
  };
  const intent = {
    sourceSha: state.sourceSha,
    captureSha256: state.captureSha256,
    policyFileSha256: state.policyFileSha256,
    pathSetSha256: sha256(JSON.stringify([destination])),
    transitionPaths: [destination],
  };
  await assert.rejects(
    replaceBootstrapFile(
      { currentDirectory: '/state/current', destination, bytes: newBytes },
      {
        readState: async () => state,
        readIntent: async () => intent,
        chownFile: async () => undefined,
        linkFile: async (temporary, target) => {
          await writeFile(target, attackerBytes, { mode: 0o600 });
          await link(temporary, target);
        },
      }
    ),
    { code: 'EEXIST' }
  );
  assert.deepEqual(await readFile(destination), attackerBytes);
});

test('reconciles a linked current file when temporary unlink was interrupted', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-linked-current-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'watchdog.service');
  const bytes = Buffer.from('watchdog\n');
  const expected = {
    sha256: sha256(bytes),
    mode: '0600',
    owner: 'root:root',
  };
  const state = {
    phase: 'captured',
    sourceSha: 'b'.repeat(40),
    captureSha256: '3'.repeat(64),
    policyFileSha256: '5'.repeat(64),
    prior: { [destination]: { absent: true } },
    files: { [destination]: expected },
  };
  const intent = {
    sourceSha: state.sourceSha,
    captureSha256: state.captureSha256,
    policyFileSha256: state.policyFileSha256,
    pathSetSha256: sha256(JSON.stringify([destination])),
    transitionPaths: [destination],
  };
  const projection = async (files) => {
    const result = {};
    for (const path of Object.keys(files)) {
      let details;
      try {
        details = await stat(path);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        result[path] = { absent: true };
        continue;
      }
      result[path] = {
        sha256: sha256(await readFile(path)),
        mode: (details.mode & 0o777).toString(8).padStart(4, '0'),
        owner: 'root:root',
      };
    }
    return result;
  };
  const input = { currentDirectory: '/state/current', destination, bytes };
  const dependencies = {
    readState: async () => state,
    readIntent: async () => intent,
    readProjection: projection,
    chownFile: async () => undefined,
  };
  await assert.rejects(
    replaceBootstrapFile(input, {
      ...dependencies,
      temporaryId: () => 'post-link-crash',
      removeFile: () => Promise.reject(new Error('unlink interrupted')),
    }),
    /unlink interrupted/
  );
  assert.deepEqual(await readFile(destination), bytes);
  assert.equal(
    (await readdir(root)).filter((entry) =>
      entry.startsWith('.baci-bootstrap-replacement-')
    ).length,
    1
  );
  assert.equal(await replaceBootstrapFile(input, dependencies), 'current');
  assert.deepEqual(await readdir(root), ['watchdog.service']);
});
