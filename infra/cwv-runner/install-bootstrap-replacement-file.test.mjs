import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdtemp,
  readdir,
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
import { exchangeTestPaths } from './install-bootstrap-replacement-file.test-helper.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const oldSource = 'a'.repeat(40);
const newSource = 'b'.repeat(40);

async function fixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-file-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  const destination = join(root, 'bootstrap.sha256');
  const oldBytes = Buffer.from(`${'1'.repeat(64)}\n`);
  const newBytes = Buffer.from(`${'2'.repeat(64)}\n`);
  await writeFile(destination, oldBytes, { mode: 0o600 });
  await chmod(destination, 0o600);
  const metadata = (bytes) => ({
    mode: '0600',
    owner: 'root:root',
    sha256: sha256(bytes),
  });
  const state = {
    phase: 'captured',
    sourceSha: newSource,
    captureSha256: '3'.repeat(64),
    policyFileSha256: '5'.repeat(64),
    prior: { [destination]: metadata(oldBytes) },
    files: { [destination]: metadata(newBytes) },
  };
  const intent = {
    schemaVersion: 1,
    baselineKind: 'complete',
    baselineSourceSha: oldSource,
    baselineStateSha256: '4'.repeat(64),
    sourceSha: newSource,
    captureSha256: '3'.repeat(64),
    pathSetSha256: sha256(JSON.stringify([destination])),
    policyFileSha256: '5'.repeat(64),
    transitionPaths: [destination],
  };
  const input = {
    currentDirectory: '/state/bootstrap-bbbbbbbbbbbb',
    destination,
    bytes: newBytes,
  };
  return { destination, input, intent, newBytes, oldBytes, state };
}

test('atomically replaces only a receipt-bound prior bootstrap file', async (context) => {
  const value = await fixture(context);
  const publication = [];
  const projection = async (files) => {
    const result = {};
    for (const path of Object.keys(files))
      result[path] = {
        sha256: sha256(await readFile(path)),
        mode: (await stat(path)).mode.toString(8).slice(-3).padStart(4, '0'),
        owner: 'root:root',
      };
    return result;
  };

  assert.equal(
    await replaceBootstrapFile(value.input, {
      readState: async () => value.state,
      readIntent: async () => value.intent,
      readProjection: projection,
      exchangeFile: exchangeTestPaths,
      chownFile: async () => publication.push('chown'),
      syncMetadata: async (path) => {
        assert.equal((await stat(path)).mode.toString(8).slice(-3), '600');
        publication.push('sync');
      },
    }),
    'replaced'
  );
  assert.deepEqual(publication, ['chown', 'sync']);
  assert.deepEqual(await readFile(value.destination), value.newBytes);
  assert.equal(
    await replaceBootstrapFile(value.input, {
      readState: async () => value.state,
      readIntent: async () => value.intent,
      readProjection: projection,
      chownFile: async () => publication.push('unexpected'),
      syncMetadata: async () => publication.push('unexpected'),
    }),
    'current'
  );
});

test('refuses an unplanned path, unexpected bytes, or third-party installed drift', async (context) => {
  const value = await fixture(context);
  const dependencies = {
    readState: async () => value.state,
    readIntent: async () => value.intent,
    readProjection: async () => ({
      [value.destination]: {
        ...value.state.prior[value.destination],
        sha256: '9'.repeat(64),
      },
    }),
    chownFile: async () => undefined,
  };

  await assert.rejects(
    replaceBootstrapFile(
      { ...value.input, destination: `${value.destination}.other` },
      dependencies
    ),
    /not authorized/
  );
  await assert.rejects(
    replaceBootstrapFile(
      { ...value.input, bytes: Buffer.from('unexpected') },
      dependencies
    ),
    /replacement bytes mismatch/
  );
  await assert.rejects(
    replaceBootstrapFile(value.input, dependencies),
    /installed bootstrap replacement drift/
  );
});

test('uses an attempt-unique temporary and preserves prior bytes on replacement failure', async (context) => {
  const value = await fixture(context);
  let temporary;

  await assert.rejects(
    replaceBootstrapFile(value.input, {
      readState: async () => value.state,
      readIntent: async () => value.intent,
      readProjection: async () => ({
        [value.destination]: value.state.prior[value.destination],
      }),
      temporaryId: () => 'attempt-unique',
      chownFile: (path) => {
        temporary = path;
        throw new Error('chown failed');
      },
    }),
    /chown failed/
  );
  assert.match(temporary, /attempt-unique$/);
  assert.deepEqual(await readFile(value.destination), value.oldBytes);
  assert.deepEqual(await readdir(join(value.destination, '..')), [
    'bootstrap.sha256',
  ]);
});

test('reconciles exact temporaries left before or after metadata sync', async (context) => {
  const value = await fixture(context);
  const directory = join(value.destination, '..');
  const stale = join(
    directory,
    `.baci-bootstrap-replacement-v2-${sha256(value.destination)}-${sha256(value.newBytes)}-dead-at-rename`
  );
  value.state.files[value.destination] = {
    ...value.state.files[value.destination],
    mode: '0550',
    owner: 'root:baci-cwv',
  };
  let staleOwner = 'root:root';
  await writeFile(stale, value.newBytes, { mode: 0o600 });
  const projection = async (files) => {
    const result = {};
    for (const path of Object.keys(files)) {
      const details = await stat(path);
      result[path] = {
        sha256: sha256(await readFile(path)),
        mode: details.mode.toString(8).slice(-3).padStart(4, '0'),
        owner:
          path === stale
            ? staleOwner
            : sha256(await readFile(path)) === sha256(value.newBytes)
              ? 'root:baci-cwv'
              : 'root:root',
      };
    }
    return result;
  };
  const dependencies = {
    readState: async () => value.state,
    readIntent: async () => value.intent,
    readProjection: projection,
    exchangeFile: exchangeTestPaths,
    temporaryId: () => 'retry',
    chownFile: async () => undefined,
  };
  assert.equal(
    await replaceBootstrapFile(value.input, dependencies),
    'replaced'
  );
  assert.deepEqual(await readdir(directory), ['bootstrap.sha256']);
  await writeFile(stale, value.newBytes, { mode: 0o600 });
  staleOwner = 'root:baci-cwv';
  assert.equal(
    await replaceBootstrapFile(value.input, dependencies),
    'current'
  );
  await writeFile(stale, value.newBytes, { mode: 0o600 });
  await chmod(stale, 0o550);
  assert.equal(
    await replaceBootstrapFile(value.input, dependencies),
    'current'
  );
  assert.deepEqual(await readdir(directory), ['bootstrap.sha256']);
});

test('fails closed on unsafe or unexpected replacement temporary residue', async (context) => {
  const value = await fixture(context);
  const directory = join(value.destination, '..');
  await writeFile(value.destination, value.newBytes, { mode: 0o600 });
  const target = join(directory, 'attacker');
  await writeFile(target, value.newBytes, { mode: 0o600 });
  const foreignSymlink = join(
    directory,
    `.baci-bootstrap-replacement-v2-${sha256(value.destination)}-${'9'.repeat(64)}-symlink`
  );
  await symlink(target, foreignSymlink);

  const dependencies = {
    readState: async () => value.state,
    readIntent: async () => value.intent,
    readProjection: (files) => {
      const [path] = Object.keys(files);
      if (path === value.destination)
        return { [path]: value.state.files[path] };
      throw new TypeError(`unsafe installed bootstrap path: ${path}`);
    },
  };
  await assert.rejects(
    replaceBootstrapFile(value.input, dependencies),
    /unsafe installed bootstrap path/
  );

  await rm(foreignSymlink);
  await writeFile(
    join(directory, '.baci-bootstrap-replacement-UPPER'),
    value.newBytes,
    { mode: 0o600 }
  );
  await assert.rejects(
    replaceBootstrapFile(value.input, dependencies),
    /unexpected bootstrap replacement residue/
  );
  await rm(join(directory, '.baci-bootstrap-replacement-UPPER'));
  const validResidue = join(
    directory,
    '.baci-bootstrap-replacement-valid-name'
  );
  const projectResidue = async (files) => {
    const [path] = Object.keys(files);
    if (path === value.destination) return { [path]: value.state.files[path] };
    return {
      [path]: {
        sha256: sha256(await readFile(path)),
        mode: (await stat(path)).mode.toString(8).slice(-3).padStart(4, '0'),
        owner: 'root:root',
      },
    };
  };
  await writeFile(validResidue, Buffer.from('wrong bytes'), { mode: 0o600 });
  await assert.rejects(
    replaceBootstrapFile(value.input, {
      ...dependencies,
      readProjection: projectResidue,
    }),
    /bootstrap replacement temporary drift/
  );
  await rm(validResidue);
  await writeFile(validResidue, value.newBytes, { mode: 0o644 });
  await assert.rejects(
    replaceBootstrapFile(value.input, {
      ...dependencies,
      readProjection: projectResidue,
    }),
    /bootstrap replacement temporary drift/
  );
});
