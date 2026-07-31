import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test from 'node:test';
import { reconcileBootstrapWatchdogResidue } from './install-bootstrap-watchdog-residue.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const source = (value) => value.repeat(40);
const stateSha = (value) => value.repeat(64);

test('generation C retires only an authenticated generation B watchdog render', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-watchdog-bound-residue-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, 'baci-cwv-campaign-watchdog@.service');
  const token = '@BACI_CWV_SOURCE_SHA@';
  const templates = Object.fromEntries(
    ['a', 'b', 'c'].map((key) => [key, `watchdog ${key} ${token}\n`])
  );
  const bytes = Object.fromEntries(
    Object.entries(templates).map(([key, value]) => [
      key,
      Buffer.from(value.replace(token, source(key))),
    ])
  );
  const states = Object.fromEntries(
    Object.entries(bytes).map(([key, value], index) => [
      key,
      {
        phase: 'captured',
        sourceSha: source(key),
        captureSha256: stateSha(String(index + 1)),
        policyFileSha256: stateSha('9'),
        files: {
          [destination]: {
            sha256: sha256(value),
            mode: '0644',
            owner: 'root:root',
          },
        },
      },
    ])
  );
  const directory = (key) =>
    `/state/bootstrap-${states[key].sourceSha.slice(0, 12)}`;
  const authorityChain = Object.values(states).map((state) => ({
    sourceSha: state.sourceSha,
    stateSha256: state.captureSha256,
  }));
  const intent = {
    sourceSha: states.c.sourceSha,
    captureSha256: states.c.captureSha256,
    policyFileSha256: states.c.policyFileSha256,
    pathSetSha256: sha256(JSON.stringify([destination])),
    transitionPaths: [destination],
    authorityChain,
  };
  const stateByDirectory = new Map(
    Object.keys(states).map((key) => [basename(directory(key)), states[key]])
  );
  const sourceRoot = join(root, 'source');
  for (const key of Object.keys(states)) {
    const generation = join(sourceRoot, states[key].sourceSha);
    await mkdir(generation, { recursive: true });
    await writeFile(join(generation, basename(destination)), templates[key]);
  }
  const pinned = async (path) => {
    const details = await lstat(path);
    if (!details.isFile() || details.isSymbolicLink())
      throw new TypeError('unsafe bootstrap source path');
    return {
      bytes: await readFile(path),
      details: { ...details, uid: 0, gid: 0 },
    };
  };
  const dependencies = {
    readState: async (path) => stateByDirectory.get(basename(path)),
    readIntent: async () => intent,
    readPinnedFile: pinned,
    syncDirectory: async () => undefined,
  };
  const name = (digest, attempt) =>
    `.baci-cwv-watchdog-v1-${sha256(destination)}-${digest}-${attempt}`;
  const interrupted = join(root, '.baci-cwv-watchdog.A1b2C3');
  const boundInterrupted = join(root, name(sha256(bytes.b), 'B2c3D4'));
  await writeFile(interrupted, bytes.a.subarray(0, 11), { mode: 0o600 });
  await chmod(interrupted, 0o600);
  await writeFile(boundInterrupted, bytes.b, { mode: 0o644 });

  await reconcileBootstrapWatchdogResidue(
    { currentDirectory: directory('c'), destination, sourceRoot },
    dependencies
  );

  assert.deepEqual(
    (await readdir(root)).filter((entry) => entry.startsWith('.baci-cwv')),
    []
  );

  const installedPrior = destination;
  await writeFile(interrupted, bytes.a, { mode: 0o644 });
  await link(interrupted, installedPrior);
  await reconcileBootstrapWatchdogResidue(
    { currentDirectory: directory('c'), destination, sourceRoot },
    dependencies
  );
  assert.ok((await readdir(root)).includes(basename(destination)));

  const foreign = join(root, '.baci-cwv-watchdog.D4e5F6');
  await writeFile(foreign, Buffer.from('foreign\n'), { mode: 0o600 });
  await assert.rejects(
    reconcileBootstrapWatchdogResidue(
      { currentDirectory: directory('c'), destination, sourceRoot },
      dependencies
    ),
    /watchdog render temporary drift/
  );
  assert.equal(await readFile(foreign, 'utf8'), 'foreign\n');

  await rm(foreign);
  const unboundBytes = Buffer.from('watchdog unbound generation\n');
  const unbound = join(root, name(sha256(unboundBytes), 'E5f6G7'));
  await writeFile(unbound, unboundBytes, { mode: 0o644 });
  await assert.rejects(
    reconcileBootstrapWatchdogResidue(
      { currentDirectory: directory('c'), destination, sourceRoot },
      dependencies
    ),
    /watchdog render temporary drift/
  );
  assert.deepEqual(await readFile(unbound), unboundBytes);

  await rm(unbound);
  const unsafe = join(root, name(sha256(bytes.b), 'G7h8I9'));
  await symlink(destination, unsafe);
  await assert.rejects(
    reconcileBootstrapWatchdogResidue(
      { currentDirectory: directory('c'), destination, sourceRoot },
      dependencies
    ),
    /unsafe bootstrap source path/
  );
  assert.ok((await lstat(unsafe)).isSymbolicLink());
});
