import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { replaceBootstrapFile } from './install-bootstrap-replacement-file.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-legacy-temp-'));
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
    for (const path of Object.keys(files)) {
      const details = await stat(path);
      result[path] = {
        sha256: sha256(await readFile(path)),
        mode: (details.mode & 0o777).toString(8).padStart(4, '0'),
        owner: 'root:root',
      };
    }
    return result;
  };
  return { destination, intent, newBytes, oldBytes, projection, root, state };
}

test('removes only exact historical ensure-file temporary residue', async (context) => {
  const value = await fixture(context);
  await writeFile(value.destination, value.newBytes, { mode: 0o600 });
  const residue = join(value.root, '.tmp.A1b2C3');
  const unrelated = join(value.root, '.tmp.not-historical');
  await writeFile(residue, value.oldBytes, { mode: 0o600 });
  await writeFile(unrelated, 'retain', { mode: 0o600 });
  assert.equal(
    await replaceBootstrapFile(
      {
        currentDirectory: '/state/current',
        destination: value.destination,
        bytes: value.newBytes,
      },
      {
        readState: async () => value.state,
        readIntent: async () => value.intent,
        readProjection: value.projection,
      }
    ),
    'current'
  );
  await assert.rejects(readFile(residue), { code: 'ENOENT' });
  assert.equal(await readFile(unrelated, 'utf8'), 'retain');
});

test('rejects a symlink in the exact historical temporary namespace', async (context) => {
  const value = await fixture(context);
  await writeFile(value.destination, value.newBytes, { mode: 0o600 });
  const target = join(value.root, 'target');
  await writeFile(target, value.oldBytes, { mode: 0o600 });
  await symlink(target, join(value.root, '.tmp.A1b2C3'));
  await assert.rejects(
    replaceBootstrapFile(
      {
        currentDirectory: '/state/current',
        destination: value.destination,
        bytes: value.newBytes,
      },
      {
        readState: async () => value.state,
        readIntent: async () => value.intent,
        readProjection: (files) => {
          const [path] = Object.keys(files);
          if (path === value.destination)
            return { [path]: value.state.files[path] };
          throw new TypeError(`unsafe installed bootstrap path: ${path}`);
        },
      }
    ),
    /unsafe installed bootstrap path/
  );
});

test('retains and rejects historical residue with byte or mode drift', async (context) => {
  const value = await fixture(context);
  await writeFile(value.destination, value.newBytes, { mode: 0o600 });
  const residue = join(value.root, '.tmp.A1b2C3');
  const dependencies = {
    readState: async () => value.state,
    readIntent: async () => value.intent,
    readProjection: value.projection,
  };
  for (const [bytes, mode] of [
    [Buffer.from('foreign\n'), 0o600],
    [value.oldBytes, 0o644],
  ]) {
    await writeFile(residue, bytes, { mode });
    await assert.rejects(
      replaceBootstrapFile(
        {
          currentDirectory: '/state/current',
          destination: value.destination,
          bytes: value.newBytes,
        },
        dependencies
      ),
      /bootstrap replacement temporary drift/
    );
    assert.deepEqual(await readFile(residue), bytes);
    await rm(residue);
  }
});
