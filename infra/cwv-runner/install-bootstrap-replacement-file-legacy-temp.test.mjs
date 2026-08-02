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

test('reconciles a later authorized path temporary before processing the first path', async (context) => {
  const value = await fixture(context);
  const laterDestination = join(value.root, 'source-manifest.sha256');
  const laterOldBytes = Buffer.from('later-old\n');
  const laterNewBytes = Buffer.from('later-new\n');
  value.state.prior[laterDestination] = {
    sha256: sha256(laterOldBytes),
    mode: '0600',
    owner: 'root:root',
  };
  value.state.files[laterDestination] = {
    sha256: sha256(laterNewBytes),
    mode: '0600',
    owner: 'root:root',
  };
  value.intent.transitionPaths.push(laterDestination);
  value.intent.pathSetSha256 = sha256(
    JSON.stringify(Object.keys(value.state.files).sort())
  );
  await writeFile(value.destination, value.newBytes, { mode: 0o600 });
  const residue = join(value.root, '.tmp.A1b2C3');
  await writeFile(residue, laterNewBytes, { mode: 0o600 });

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
});

test('does not attribute an unbound temporary to an authorized path in another directory', async (context) => {
  const value = await fixture(context);
  const elsewhere = join(value.root, 'elsewhere', 'source.sha256');
  const elsewhereBytes = Buffer.from('elsewhere\n');
  value.state.prior[elsewhere] = { absent: true };
  value.state.files[elsewhere] = {
    sha256: sha256(elsewhereBytes),
    mode: '0600',
    owner: 'root:root',
  };
  value.intent.transitionPaths.push(elsewhere);
  value.intent.pathSetSha256 = sha256(
    JSON.stringify(Object.keys(value.state.files).sort())
  );
  await writeFile(value.destination, value.newBytes, { mode: 0o600 });
  const residue = join(value.root, '.tmp.A1b2C3');
  await writeFile(residue, elsewhereBytes, { mode: 0o600 });

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
        readProjection: value.projection,
      }
    ),
    /bootstrap replacement temporary drift/
  );
  assert.deepEqual(await readFile(residue), elsewhereBytes);
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

test('reconciles historical residue before a receipt-bound absent install', async (context) => {
  const value = await fixture(context);
  value.state.prior[value.destination] = { absent: true };
  const residue = join(value.root, '.tmp.A1b2C3');
  await writeFile(residue, value.newBytes, { mode: 0o600 });
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
        chownFile: async () => undefined,
      }
    ),
    'replaced'
  );
  assert.deepEqual(await readFile(value.destination), value.newBytes);
  await assert.rejects(readFile(residue), { code: 'ENOENT' });
});
