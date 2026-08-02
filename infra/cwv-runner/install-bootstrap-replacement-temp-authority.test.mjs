import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test from 'node:test';

import { replaceBootstrapFile } from './install-bootstrap-replacement-file.mjs';
import { exchangeTestPaths } from './install-bootstrap-replacement-file.test-helper.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = (character) => character.repeat(40);
const digest = (character) => character.repeat(64);
const metadata = (bytes) => ({
  mode: '0600',
  owner: 'root:root',
  sha256: sha256(bytes),
});

async function fixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'baci-post-exchange-temp-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'bootstrap.sha256');
  const bytes = {
    a: Buffer.from('generation-a\n'),
    b: Buffer.from('generation-b\n'),
    c: Buffer.from('generation-c\n'),
  };
  await writeFile(destination, bytes.a, { mode: 0o600 });
  await chmod(destination, 0o600);
  const state = {
    a: {
      phase: 'captured',
      sourceSha: source('a'),
      captureSha256: digest('1'),
      policyFileSha256: digest('9'),
      prior: { [destination]: { absent: true } },
      files: { [destination]: metadata(bytes.a) },
    },
    b: {
      phase: 'captured',
      sourceSha: source('b'),
      captureSha256: digest('2'),
      policyFileSha256: digest('9'),
      prior: { [destination]: metadata(bytes.a) },
      files: { [destination]: metadata(bytes.b) },
    },
    c: {
      phase: 'captured',
      sourceSha: source('c'),
      captureSha256: digest('3'),
      policyFileSha256: digest('9'),
      prior: { [destination]: metadata(bytes.b) },
      files: { [destination]: metadata(bytes.c) },
    },
  };
  const directory = (key) =>
    `/state/bootstrap-${state[key].sourceSha.slice(0, 12)}`;
  const authorityChain = ['a', 'b', 'c'].map((key) => ({
    sourceSha: state[key].sourceSha,
    stateSha256: state[key].captureSha256,
  }));
  const intent = (key) => ({
    sourceSha: state[key].sourceSha,
    captureSha256: state[key].captureSha256,
    policyFileSha256: state[key].policyFileSha256,
    pathSetSha256: sha256(JSON.stringify([destination])),
    transitionPaths: [destination],
    authorityChain,
  });
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
  const states = new Map(
    ['a', 'b', 'c'].map((key) => [basename(directory(key)), state[key]])
  );
  return {
    authorityChain,
    bytes,
    destination,
    directory,
    intent,
    projection,
    state,
    states,
  };
}

async function leavePostExchangeTemporary(value) {
  await assert.rejects(
    replaceBootstrapFile(
      {
        currentDirectory: value.directory('b'),
        destination: value.destination,
        bytes: value.bytes.b,
      },
      {
        readState: async () => value.state.b,
        readIntent: async () => value.intent('b'),
        readProjection: value.projection,
        exchangeFile: exchangeTestPaths,
        temporaryId: () => 'generation-b-crash',
        chownFile: async () => undefined,
        removeFile: () => Promise.reject(new Error('crash after exchange')),
      }
    ),
    /crash after exchange/
  );
  const [temporary] = (await readdir(join(value.destination, '..'))).filter(
    (entry) => entry.startsWith('.baci-bootstrap-replacement-')
  );
  assert.deepEqual(await readFile(value.destination), value.bytes.b);
  assert.deepEqual(
    await readFile(join(value.destination, '..', temporary)),
    value.bytes.a
  );
  return temporary;
}

test('generation C retires an authority-bound generation B post-exchange temporary', async (context) => {
  const value = await fixture(context);
  await leavePostExchangeTemporary(value);

  assert.equal(
    await replaceBootstrapFile(
      {
        currentDirectory: value.directory('c'),
        destination: value.destination,
        bytes: value.bytes.c,
      },
      {
        readState: async (directory) => value.states.get(basename(directory)),
        readIntent: async () => value.intent('c'),
        readProjection: value.projection,
        exchangeFile: exchangeTestPaths,
        temporaryId: () => 'generation-c',
        chownFile: async () => undefined,
      }
    ),
    'replaced'
  );
  assert.deepEqual(await readFile(value.destination), value.bytes.c);
  assert.deepEqual(await readdir(join(value.destination, '..')), [
    'bootstrap.sha256',
  ]);
});

test('refuses post-exchange residue whose predecessor state is not bound by authority', async (context) => {
  const value = await fixture(context);
  const temporary = await leavePostExchangeTemporary(value);
  value.authorityChain[1] = {
    ...value.authorityChain[1],
    stateSha256: digest('8'),
  };

  await assert.rejects(
    replaceBootstrapFile(
      {
        currentDirectory: value.directory('c'),
        destination: value.destination,
        bytes: value.bytes.c,
      },
      {
        readState: async (directory) => value.states.get(basename(directory)),
        readIntent: async () => value.intent('c'),
        readProjection: value.projection,
        exchangeFile: exchangeTestPaths,
        chownFile: async () => undefined,
      }
    ),
    /bootstrap replacement temporary drift/
  );
  assert.deepEqual(await readFile(value.destination), value.bytes.b);
  assert.deepEqual(
    await readFile(join(value.destination, '..', temporary)),
    value.bytes.a
  );
});
