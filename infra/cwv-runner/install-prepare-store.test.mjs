import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdtemp,
  open,
  readdir,
  readFile,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { copyExternalNoFollow } from './install-input-copy.mjs';
import { beginPrepare } from './install-prepare.mjs';
import {
  markWatchdogArmed,
  persistPrepareState,
  readPrepareState,
} from './install-prepare-store.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const IMAGE = `sha256:${'f'.repeat(64)}`;
const begin = () =>
  beginPrepare({
    transactionId: 'prepare-a',
    external: {
      archive: { path: '/owner/image.tar', device: '1', inode: '2' },
      receipt: { path: '/owner/build.json', device: '1', inode: '3' },
    },
    expected: { archiveSha256: 'a'.repeat(64), receiptSha256: 'b'.repeat(64) },
    sourceManifestSha256: 'c'.repeat(64),
    policyFileSha256: 'd'.repeat(64),
  });

test('persists monotonic prepare phases and validates their digest', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-prepare-state-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(directory, { recursive: true, force: true })
    )
  );
  await chmod(directory, 0o700);
  await persistPrepareState(directory, begin());
  const armed = markWatchdogArmed(
    await readPrepareState(directory),
    'e'.repeat(64)
  );
  await persistPrepareState(directory, armed);

  assert.equal((await readPrepareState(directory)).phase, 'watchdog-armed');
  assert.equal(
    (await lstat(join(directory, 'prepare-state.json'))).mode & 0o777,
    0o600
  );
  const envelope = JSON.parse(
    await readFile(join(directory, 'prepare-state.json'), 'utf8')
  );
  assert.deepEqual(
    Object.keys(envelope).sort(),
    [
      'phase',
      'schemaVersion',
      'stateSha256',
      'transactionId',
      'external',
      'expected',
      'policyFileSha256',
      'sourceManifestSha256',
      'watchdogReceiptSha256',
    ].sort()
  );
  assert.match(envelope.stateSha256, /^[0-9a-f]{64}$/);
  assert.equal(
    (await readdir(directory)).includes('prepare-state.sha256'),
    false
  );
  await writeFile(
    join(directory, 'prepare-state.json'),
    JSON.stringify({
      ...envelope,
      stateSha256: 'f'.repeat(64),
    })
  );
  await assert.rejects(
    () => readPrepareState(directory),
    /prepare state digest/
  );
});

test('removes an interrupted atomic prepare-state temporary without masking sync failure', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-prepare-atomic-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(directory, { recursive: true, force: true })
    )
  );
  await chmod(directory, 0o700);
  const probe = await open(join(directory, 'probe'), 'w');
  const prototype = Object.getPrototypeOf(probe);
  const originalSync = prototype.sync;
  await probe.close();
  let calls = 0;
  prototype.sync = function refusedSync(...args) {
    calls += 1;
    if (calls === 1) throw new Error('simulated state sync failure');
    return originalSync.apply(this, args);
  };
  try {
    await assert.rejects(
      () => persistPrepareState(directory, begin()),
      /simulated state sync failure/
    );
    assert.equal(
      (await readdir(directory)).some((name) =>
        name.startsWith('.prepare-state.json-')
      ),
      false
    );
  } finally {
    prototype.sync = originalSync;
  }
});

test('reads a legacy sidecar state and upgrades it on its next transition', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-prepare-legacy-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(directory, { recursive: true, force: true })
    )
  );
  await chmod(directory, 0o700);
  await persistPrepareState(directory, begin());
  const legacy = JSON.parse(
    await readFile(join(directory, 'prepare-state.json'), 'utf8')
  );
  delete legacy.stateSha256;
  const bytes = JSON.stringify(legacy);
  await writeFile(join(directory, 'prepare-state.json'), bytes, {
    mode: 0o600,
  });
  await writeFile(
    join(directory, 'prepare-state.sha256'),
    `${sha256(bytes)}\n`,
    { mode: 0o600 }
  );

  const state = await readPrepareState(directory);
  assert.equal(state.stateSha256, sha256(bytes));
  await persistPrepareState(
    directory,
    markWatchdogArmed(state, 'e'.repeat(64))
  );
  assert.equal(
    (await readdir(directory)).includes('prepare-state.sha256'),
    false
  );
});

test('copies a captured regular file without following links and binds its identity', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-input-copy-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(directory, { recursive: true, force: true })
    )
  );
  await chmod(directory, 0o700);
  const source = join(directory, 'source');
  const destination = join(directory, 'copied');
  await writeFile(source, 'owner-frozen', { mode: 0o600 });
  const identity = await lstat(source);
  const result = await copyExternalNoFollow({
    source,
    destination,
    identity: { device: String(identity.dev), inode: String(identity.ino) },
    expectedSha256: sha256('owner-frozen'),
    maxBytes: 1024,
  });

  assert.equal(result.sha256, sha256('owner-frozen'));
  assert.equal(await readFile(destination, 'utf8'), 'owner-frozen');
  assert.equal((await lstat(destination)).mode & 0o777, 0o600);
  const linked = join(directory, 'linked');
  await symlink(source, linked);
  await assert.rejects(
    () =>
      copyExternalNoFollow({
        source: linked,
        destination: join(directory, 'refused'),
        identity: { device: String(identity.dev), inode: String(identity.ino) },
        expectedSha256: sha256('owner-frozen'),
        maxBytes: 1024,
      }),
    /no-follow|identity/
  );
});

test('preserves a pre-existing exclusive destination after a refused copy', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-input-existing-'));
  context.after(() =>
    import('node:fs/promises').then(({ rm }) =>
      rm(directory, { recursive: true, force: true })
    )
  );
  await chmod(directory, 0o700);
  const source = join(directory, 'source');
  const destination = join(directory, 'destination');
  await writeFile(source, 'frozen');
  await writeFile(destination, 'existing');
  const identity = await lstat(source);
  await assert.rejects(() =>
    copyExternalNoFollow({
      source,
      destination,
      identity: { device: String(identity.dev), inode: String(identity.ino) },
      expectedSha256: sha256('frozen'),
      maxBytes: 1024,
    })
  );
  assert.equal(await readFile(destination, 'utf8'), 'existing');
});

test('refuses phase skips and pre-watchdog copying', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-prepare-order-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(directory, { recursive: true, force: true })
    )
  );
  await chmod(directory, 0o700);
  await persistPrepareState(directory, begin());

  await assert.rejects(
    () =>
      persistPrepareState(directory, { ...begin(), phase: 'copies-verified' }),
    /transition/
  );
  assert.throws(() => markWatchdogArmed(begin(), 'bad'), /watchdog/);
});

test('preserves persisted watchdog and image evidence through later valid transitions', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-prepare-drift-'));
  context.after(() =>
    import('node:fs/promises').then(({ rm }) =>
      rm(directory, { recursive: true, force: true })
    )
  );
  await chmod(directory, 0o700);
  await persistPrepareState(directory, begin());
  const armed = markWatchdogArmed(
    await readPrepareState(directory),
    'e'.repeat(64)
  );
  await persistPrepareState(directory, armed);
  const copied = {
    ...armed,
    phase: 'copies-verified',
    imageId: IMAGE,
    imageConfigDigest: IMAGE,
  };
  await assert.rejects(
    () =>
      persistPrepareState(directory, {
        ...copied,
        watchdogReceiptSha256: 'd'.repeat(64),
      }),
    /prepare authority drift/
  );
  await assert.rejects(
    () =>
      persistPrepareState(directory, {
        ...armed,
        phase: 'copies-verified',
        imageId: IMAGE,
        imageConfigDigest: IMAGE,
        supervisorReceiptSha256: 'd'.repeat(64),
      }),
    /prepare state fields/
  );
  await persistPrepareState(directory, copied);
  await assert.rejects(
    () =>
      persistPrepareState(directory, {
        ...copied,
        phase: 'synthetic-proven',
        imageId: `sha256:${'c'.repeat(64)}`,
      }),
    /prepare authority drift/
  );
});
