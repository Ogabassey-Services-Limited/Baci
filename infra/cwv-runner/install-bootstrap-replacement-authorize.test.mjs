import assert from 'node:assert/strict';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  beginBootstrap,
  persistBootstrapCapture,
  readBootstrapState,
} from './install-bootstrap.mjs';
import { authorizeBootstrapReplacement } from './install-bootstrap-replacement-authorize.mjs';

const oldSource = 'a'.repeat(40);
const newSource = 'b'.repeat(40);
const policy = 'e'.repeat(64);
const path = '/srv/baci-cwv/sealed/bootstrap.sha256';
const oldFile = { sha256: '1'.repeat(64), mode: '0600', owner: 'root:root' };
const newFile = { sha256: '2'.repeat(64), mode: '0600', owner: 'root:root' };
const previous = {
  phase: 'complete',
  sourceSha: oldSource,
  sourceManifestSha256: '3'.repeat(64),
  policyFileSha256: policy,
  receiptSha256: '4'.repeat(64),
  receipt: {
    sourceSha: oldSource,
    sourceManifestSha256: '3'.repeat(64),
    policyFileSha256: policy,
    files: { [path]: oldFile },
  },
  files: { [path]: oldFile },
};
const current = {
  phase: 'captured',
  sourceSha: newSource,
  sourceManifestSha256: '5'.repeat(64),
  policyFileSha256: policy,
  captureSha256: '6'.repeat(64),
  prior: { [path]: oldFile },
  files: { [path]: newFile },
};
const inert = {
  acceptedImageFiles: 0,
  activeDedicatedUnits: 0,
  prepareTransactions: 0,
  registrationArtifacts: 0,
  runnerConfigurationFiles: 0,
  unsafeUnitStates: 0,
  watchdogInstances: 0,
};
const validated = (state) => ({
  journalTipSha256: state.captureSha256 ?? state.receiptSha256,
  sealReceiptSha256: state.sourceSha[0].repeat(64),
  sourceSha: state.sourceSha,
});
const options = {
  stateRoot: '/state',
  currentDirectory: '/state/bootstrap-bbbbbbbbbbbb',
  downstreamState: inert,
};

test('discovers the complete chain and persists its source provenance', async () => {
  const persisted = [];
  const result = await authorizeBootstrapReplacement(options, {
    listDirectories: async () => [
      'bootstrap-aaaaaaaaaaaa',
      'bootstrap-bbbbbbbbbbbb',
    ],
    readState: async (directory) =>
      directory.endsWith('aaaaaaaaaaaa') ? previous : current,
    readProjection: async () => ({ [path]: oldFile }),
    readIntent: () => {
      const error = new Error('missing');
      error.code = 'ENOENT';
      throw error;
    },
    validateSourceState: async ({ state }) => validated(state),
    persistIntent: async (_directory, intent) => persisted.push(intent),
  });
  assert.deepEqual(result.replace, [path]);
  assert.deepEqual(
    persisted[0].authorityChain.map((row) => row.sourceSha),
    [oldSource, newSource]
  );
  assert.equal(persisted[0].baselineStateSha256, previous.receiptSha256);

  const resumed = await authorizeBootstrapReplacement(options, {
    listDirectories: async () => [
      'bootstrap-aaaaaaaaaaaa',
      'bootstrap-bbbbbbbbbbbb',
    ],
    readState: async (directory) =>
      directory.endsWith('aaaaaaaaaaaa') ? previous : current,
    readProjection: async () => ({ [path]: newFile }),
    readIntent: async () => persisted[0],
    validateSourceState: async ({ state }) => ({
      ...validated(state),
      journalTipSha256:
        state.sourceSha === newSource
          ? 'f'.repeat(64)
          : validated(state).journalTipSha256,
    }),
    persistIntent: () => {
      throw new Error('resume must not republish intent');
    },
  });
  assert.deepEqual(resumed.alreadyCurrent, [path]);

  await assert.rejects(
    authorizeBootstrapReplacement(options, {
      listDirectories: async () => [
        'bootstrap-aaaaaaaaaaaa',
        'bootstrap-bbbbbbbbbbbb',
      ],
      readState: async (directory) =>
        directory.endsWith('aaaaaaaaaaaa') ? previous : current,
      readProjection: async () => ({ [path]: newFile }),
      readIntent: async () => persisted[0],
      validateSourceState: async ({ state }) => ({
        ...validated(state),
        journalTipSha256:
          state.sourceSha === oldSource
            ? '0'.repeat(64)
            : validated(state).journalTipSha256,
      }),
    }),
    /replacement intent authority drift/
  );
});

test('refuses an orphan captured transaction outside the complete chain', async () => {
  const orphan = {
    ...current,
    sourceSha: 'c'.repeat(40),
    captureSha256: 'c'.repeat(64),
    prior: { [path]: { ...oldFile, sha256: 'c'.repeat(64) } },
  };
  await assert.rejects(
    authorizeBootstrapReplacement(options, {
      listDirectories: async () => [
        'bootstrap-aaaaaaaaaaaa',
        'bootstrap-bbbbbbbbbbbb',
        'bootstrap-cccccccccccc',
      ],
      readState: async (directory) =>
        directory.endsWith('aaaaaaaaaaaa')
          ? previous
          : directory.endsWith('cccccccccccc')
            ? orphan
            : current,
      readProjection: async () => ({ [path]: oldFile }),
      validateSourceState: async ({ state }) => validated(state),
    }),
    /replacement authority chain/
  );
});

test('reconciles a transaction directory left before capture publication', async (context) => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'baci-pre-capture-'));
  context.after(() => rm(stateRoot, { recursive: true, force: true }));
  await chmod(stateRoot, 0o700);
  const interruptedSource = 'c'.repeat(40);
  const interrupted = beginBootstrap({
    transactionId: `bootstrap-${interruptedSource.slice(0, 12)}`,
    sourceSha: interruptedSource,
    sourceManifestSha256: '7'.repeat(64),
    policyFileSha256: policy,
    prior: { [path]: oldFile },
    files: { [path]: newFile },
  });
  const probe = await open(join(stateRoot, 'probe'), 'w');
  const prototype = Object.getPrototypeOf(probe);
  const originalSync = prototype.sync;
  await probe.close();
  prototype.sync = () => Promise.reject(new Error('crash after mkdir'));
  try {
    await assert.rejects(
      persistBootstrapCapture(stateRoot, interrupted),
      /crash after mkdir/
    );
  } finally {
    prototype.sync = originalSync;
  }
  await rm(join(stateRoot, 'probe'));
  const interruptedDirectory = join(stateRoot, interrupted.transactionId);
  assert.deepEqual(await readdir(interruptedDirectory), []);

  const result = await authorizeBootstrapReplacement(
    {
      ...options,
      stateRoot,
      currentDirectory: join(
        stateRoot,
        current.transactionId ?? 'bootstrap-bbbbbbbbbbbb'
      ),
    },
    {
      listDirectories: async () => [
        'bootstrap-aaaaaaaaaaaa',
        'bootstrap-bbbbbbbbbbbb',
        interrupted.transactionId,
      ],
      readState: async (directory) =>
        directory === interruptedDirectory
          ? readBootstrapState(directory)
          : directory.endsWith('aaaaaaaaaaaa')
            ? previous
            : current,
      readProjection: async () => ({ [path]: oldFile }),
      readIntent: () => {
        const error = new Error('missing');
        error.code = 'ENOENT';
        throw error;
      },
      validateSourceState: async ({ state }) => validated(state),
      persistIntent: async () => undefined,
    }
  );

  assert.deepEqual(result.replace, [path]);
  await assert.rejects(lstat(interruptedDirectory), { code: 'ENOENT' });
});

test('refuses to remove an unrecognized incomplete transaction directory', async (context) => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'baci-pre-capture-drift-'));
  context.after(() => rm(stateRoot, { recursive: true, force: true }));
  await chmod(stateRoot, 0o700);
  const directory = join(stateRoot, 'bootstrap-cccccccccccc');
  await mkdir(directory, { mode: 0o700 });
  await writeFile(join(directory, 'foreign'), 'owned elsewhere', {
    mode: 0o600,
  });

  await assert.rejects(
    authorizeBootstrapReplacement(
      {
        ...options,
        stateRoot,
        currentDirectory: join(stateRoot, 'bootstrap-bbbbbbbbbbbb'),
      },
      {
        listDirectories: async () => [
          'bootstrap-aaaaaaaaaaaa',
          'bootstrap-bbbbbbbbbbbb',
          'bootstrap-cccccccccccc',
        ],
        readState: async (candidate) =>
          candidate === directory
            ? readBootstrapState(candidate)
            : candidate.endsWith('aaaaaaaaaaaa')
              ? previous
              : current,
      }
    ),
    /invalid pre-capture bootstrap transaction/
  );
  assert.equal((await lstat(join(directory, 'foreign'))).isFile(), true);
});
