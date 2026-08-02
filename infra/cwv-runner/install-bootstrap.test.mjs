import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdtemp,
  open,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  appendBootstrapJournal,
  beginBootstrap,
  completeBootstrap,
  persistBootstrapCapture,
  persistBootstrapReceipt,
  readBootstrapState,
  recoveryPlan,
} from './install-bootstrap.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const SOURCE_SHA = 'a'.repeat(40);
const files = {
  '/etc/baci-cwv/daemon.json': {
    sha256: sha256('daemon'),
    mode: '0644',
    owner: 'root:root',
  },
  '/etc/systemd/system/baci-cwv-docker.service': {
    sha256: sha256('unit'),
    mode: '0644',
    owner: 'root:root',
  },
};
const disabledUnits = {
  'baci-cwv-containerd.service': 'loaded\ninactive\ndisabled\n',
  'baci-cwv-docker.service': 'loaded\ninactive\ndisabled\n',
};
const staticUnits = {
  'baci-cwv-containerd.service': 'loaded\ninactive\nstatic\n',
  'baci-cwv-docker.service': 'loaded\ninactive\nstatic\n',
};
const bootstrapCapture = () =>
  beginBootstrap({
    transactionId: 'bootstrap-a',
    sourceSha: SOURCE_SHA,
    sourceManifestSha256: 'b'.repeat(64),
    policyFileSha256: 'c'.repeat(64),
    prior: Object.fromEntries(
      Object.keys(files).map((path) => [path, { absent: true }])
    ),
    files,
  });

test('begins with a canonical immutable capture before any planned mutation', () => {
  const capture = bootstrapCapture();

  assert.deepEqual(capture.journal, []);
  assert.equal(capture.phase, 'captured');
  assert.equal(capture.captureSha256, sha256(capture.captureBytes));
  assert.equal(
    capture.captureBytes,
    `${JSON.stringify(JSON.parse(capture.captureBytes))}`
  );
});

test('completes only an exact installed projection and emits a receipt', () => {
  const capture = bootstrapCapture();

  const result = completeBootstrap(capture, files, disabledUnits);

  assert.equal(result.phase, 'complete');
  assert.match(result.receiptSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(result.receipt.files, files);
  assert.deepEqual(result.receipt.unitStates, disabledUnits);
});

test('refuses completion without live disabled unit readback', () => {
  const capture = bootstrapCapture();
  assert.throws(() => completeBootstrap(capture, files), /unit state/);
  assert.throws(
    () =>
      completeBootstrap(capture, files, {
        'baci-cwv-docker.service': 'loaded\nactive\ndisabled\n',
      }),
    /unit state/
  );
});

test('accepts loaded inactive static dedicated units but refuses enabled or malformed readback', () => {
  const capture = bootstrapCapture();

  assert.deepEqual(
    completeBootstrap(capture, files, staticUnits).receipt.unitStates,
    staticUnits
  );
  for (const state of [
    'loaded\nactive\nstatic\n',
    'loaded\ninactive\nenabled\n',
    'loaded\ninactive\nstatic',
  ])
    assert.throws(
      () =>
        completeBootstrap(capture, files, {
          'baci-cwv-docker.service': state,
        }),
      /unit state/
    );
});

test('recovery deletes only transaction-created paths before completion', () => {
  const capture = beginBootstrap({
    transactionId: 'bootstrap-a',
    sourceSha: SOURCE_SHA,
    sourceManifestSha256: 'b'.repeat(64),
    policyFileSha256: 'c'.repeat(64),
    prior: {
      '/etc/baci-cwv/daemon.json': { absent: true },
      '/etc/systemd/system/baci-cwv-docker.service': {
        sha256: sha256('old'),
        mode: '0644',
        owner: 'root:root',
      },
    },
    files,
  });

  assert.deepEqual(recoveryPlan(capture), {
    remove: ['/etc/baci-cwv/daemon.json'],
    restore: {
      '/etc/systemd/system/baci-cwv-docker.service': {
        sha256: sha256('old'),
        mode: '0644',
        owner: 'root:root',
      },
    },
  });
});

test('refuses manifest drift, unsafe paths, and partial completion', () => {
  const input = {
    transactionId: 'bootstrap-a',
    sourceSha: SOURCE_SHA,
    sourceManifestSha256: 'b'.repeat(64),
    policyFileSha256: 'c'.repeat(64),
    prior: Object.fromEntries(
      Object.keys(files).map((path) => [path, { absent: true }])
    ),
    files,
  };
  assert.throws(
    () => beginBootstrap({ ...input, sourceManifestSha256: 'bad' }),
    /manifest/
  );
  assert.throws(
    () =>
      beginBootstrap({
        ...input,
        files: { '/tmp/evil': files[Object.keys(files)[0]] },
      }),
    /path/
  );
  const capture = beginBootstrap(input);
  assert.throws(
    () =>
      completeBootstrap(capture, {
        [Object.keys(files)[0]]: files[Object.keys(files)[0]],
      }),
    /projection/
  );
});

test('persists a private capture, hash-chained journal, and final receipt', async (context) => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'baci-bootstrap-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(stateRoot, { recursive: true, force: true })
    )
  );
  await chmod(stateRoot, 0o700);
  const capture = bootstrapCapture();

  const directory = await persistBootstrapCapture(stateRoot, capture);
  await appendBootstrapJournal(directory, {
    action: 'install-file',
    path: '/etc/baci-cwv/daemon.json',
    sha256: files['/etc/baci-cwv/daemon.json'].sha256,
  });
  const complete = completeBootstrap(capture, files, disabledUnits);
  await persistBootstrapReceipt(directory, complete);
  const stored = await readBootstrapState(directory);

  assert.equal(stored.phase, 'complete');
  assert.equal(stored.journal.length, 1);
  assert.equal(
    (await lstat(join(directory, 'capture.json'))).mode & 0o777,
    0o600
  );
  assert.equal(
    (await lstat(join(directory, 'receipt.json'))).mode & 0o777,
    0o600
  );
});

test('syncs the state root after creating a transaction before writing receipts', async (context) => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'baci-bootstrap-fsync-'));
  context.after(() =>
    import('node:fs/promises').then(({ rm }) =>
      rm(stateRoot, { recursive: true, force: true })
    )
  );
  await chmod(stateRoot, 0o700);
  const capture = beginBootstrap({
    transactionId: 'bootstrap-sync',
    sourceSha: SOURCE_SHA,
    sourceManifestSha256: 'b'.repeat(64),
    policyFileSha256: 'c'.repeat(64),
    prior: Object.fromEntries(
      Object.keys(files).map((path) => [path, { absent: true }])
    ),
    files,
  });
  const probe = await open(join(stateRoot, 'probe'), 'w');
  const prototype = Object.getPrototypeOf(probe);
  const originalSync = prototype.sync;
  await probe.close();
  prototype.sync = () => Promise.reject(new Error('state-root sync failure'));
  try {
    await assert.rejects(
      () => persistBootstrapCapture(stateRoot, capture),
      /state-root sync failure/
    );
    await assert.rejects(
      () => lstat(join(stateRoot, 'bootstrap-sync', 'capture.json')),
      { code: 'ENOENT' }
    );
  } finally {
    prototype.sync = originalSync;
  }
});

test('fails closed when durable capture bytes drift', async (context) => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'baci-bootstrap-drift-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(stateRoot, { recursive: true, force: true })
    )
  );
  await chmod(stateRoot, 0o700);
  const capture = bootstrapCapture();
  const directory = await persistBootstrapCapture(stateRoot, capture);
  await writeFile(join(directory, 'capture.json'), '{}', { mode: 0o600 });

  await assert.rejects(() => readBootstrapState(directory), /capture digest/);
  assert.equal(
    await readFile(join(directory, 'capture.sha256'), 'utf8'),
    `${capture.captureSha256}\n`
  );
});

test('fails closed when a completed receipt or its digest drifts', async (context) => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'baci-bootstrap-receipt-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(stateRoot, { recursive: true, force: true })
    )
  );
  await chmod(stateRoot, 0o700);
  const capture = bootstrapCapture();
  const directory = await persistBootstrapCapture(stateRoot, capture);
  await persistBootstrapReceipt(
    directory,
    completeBootstrap(capture, files, disabledUnits)
  );
  await writeFile(join(directory, 'receipt.json'), '{}', { mode: 0o600 });

  await assert.rejects(() => readBootstrapState(directory), /receipt digest/);
});
