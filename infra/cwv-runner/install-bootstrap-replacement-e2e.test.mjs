import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  authorizeBootstrapReplacement,
  completeBootstrapReplacement,
} from './install-bootstrap-replacement-controller.mjs';
import { replaceBootstrapFile } from './install-bootstrap-replacement-file.mjs';
import { exchangeTestPaths } from './install-bootstrap-replacement-file.test-helper.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const policy = '9'.repeat(64);
const source = (character) => character.repeat(40);
const digest = (character) => character.repeat(64);
const inertHost = {
  acceptedImageFiles: 0,
  activeDedicatedUnits: 0,
  prepareTransactions: 0,
  registrationArtifacts: 0,
  runnerConfigurationFiles: 0,
  unsafeUnitStates: 0,
  watchdogInstances: 0,
};

test('repairs the exact interrupted multi-generation bootstrap sequence and resumes after a crash', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-e2e-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  const stateRoot = join(root, 'state');
  await mkdir(stateRoot, { mode: 0o700 });
  const paths = [
    join(root, 'bootstrap.sha256'),
    join(root, 'watchdog.service'),
  ];
  const values = {
    first: [Buffer.from('first-bootstrap\n'), Buffer.from('first-watchdog\n')],
    second: [
      Buffer.from('second-bootstrap\n'),
      Buffer.from('second-watchdog\n'),
    ],
    current: [
      Buffer.from('current-bootstrap\n'),
      Buffer.from('current-watchdog\n'),
    ],
  };
  const metadata = (bytes) => ({
    mode: '0600',
    owner: 'root:root',
    sha256: sha256(bytes),
  });
  const projection = (bytes) =>
    Object.fromEntries(
      paths.map((path, index) => [path, metadata(bytes[index])])
    );
  const absent = { absent: true };
  const pristine = {
    phase: 'captured',
    transactionId: `bootstrap-${source('a').slice(0, 12)}`,
    sourceSha: source('a'),
    sourceManifestSha256: digest('1'),
    policyFileSha256: policy,
    captureSha256: digest('2'),
    prior: { [paths[0]]: absent, [paths[1]]: absent },
    files: projection(values.first),
    journal: [],
  };
  const captured = (character, prior, files, capture) => ({
    phase: 'captured',
    transactionId: `bootstrap-${source(character).slice(0, 12)}`,
    sourceSha: source(character),
    sourceManifestSha256: digest(character),
    policyFileSha256: policy,
    captureSha256: digest(capture),
    prior,
    files,
    journal: [],
  });
  const secondPrior = {
    [paths[0]]: absent,
    [paths[1]]: pristine.files[paths[1]],
  };
  const second = captured('b', secondPrior, projection(values.second), '3');
  const currentPrior = {
    [paths[0]]: second.files[paths[0]],
    [paths[1]]: second.files[paths[1]],
  };
  const current = captured('c', currentPrior, projection(values.current), '4');
  const states = new Map(
    [pristine, second, current].map((state) => [state.transactionId, state])
  );
  for (const name of states.keys())
    await mkdir(join(stateRoot, name), { mode: 0o700 });
  await writeFile(paths[0], values.second[0], { mode: 0o600 });
  await writeFile(paths[1], values.current[1], { mode: 0o600 });
  for (const path of paths) await chmod(path, 0o600);
  const readProjection = async (expected) =>
    Object.fromEntries(
      await Promise.all(
        Object.keys(expected).map(async (path) => [
          path,
          {
            mode: (await stat(path)).mode
              .toString(8)
              .slice(-3)
              .padStart(4, '0'),
            owner: 'root:root',
            sha256: sha256(await readFile(path)),
          },
        ])
      )
    );
  const currentDirectory = join(stateRoot, current.transactionId);
  const dependencies = {
    exchangeFile: exchangeTestPaths,
    listDirectories: async () => [...states.keys()],
    readProjection,
    readState: async (directory) => states.get(directory.split('/').at(-1)),
    validateSourceState: async ({ state }) => ({
      journalTipSha256: state.captureSha256 ?? state.receiptSha256,
      sealReceiptSha256: sha256(Buffer.from(state.sourceSha)),
      sourceSha: state.sourceSha,
    }),
  };

  const plan = await authorizeBootstrapReplacement(
    { stateRoot, currentDirectory, downstreamState: inertHost },
    dependencies
  );
  assert.deepEqual(plan.replace, [paths[0]]);
  assert.deepEqual(plan.alreadyCurrent, [paths[1]]);

  await replaceBootstrapFile(
    { currentDirectory, destination: paths[0], bytes: values.current[0] },
    { ...dependencies, chownFile: async () => undefined }
  );
  await authorizeBootstrapReplacement(
    { stateRoot, currentDirectory, downstreamState: inertHost },
    dependencies
  );
  assert.equal(
    await replaceBootstrapFile(
      { currentDirectory, destination: paths[0], bytes: values.current[0] },
      { ...dependencies, chownFile: async () => undefined }
    ),
    'current'
  );
  const complete = {
    ...current,
    phase: 'complete',
    receiptSha256: digest('5'),
    receipt: { files: current.files },
  };
  states.set(current.transactionId, complete);
  const receipt = await completeBootstrapReplacement(
    { currentDirectory },
    { ...dependencies, readState: async () => complete }
  );

  assert.equal(receipt.baselineKind, 'pristine');
  assert.equal(receipt.baselineSourceSha, pristine.sourceSha);
  assert.equal(receipt.baselineStateSha256, pristine.captureSha256);
  assert.equal(receipt.receiptSha256, complete.receiptSha256);
  assert.deepEqual(await readFile(paths[0]), values.current[0]);
});
