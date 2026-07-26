import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdtemp,
  open,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { copyExternalNoFollow } from './install-input-copy.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function assertCloseFailureCleanup(context, failingCloseCall) {
  const root = await mkdtemp(join(tmpdir(), 'baci-input-copy-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  await chmod(root, 0o700);
  const source = join(root, 'source');
  const destination = join(root, 'destination');
  const contents = 'sealed close-failure input';
  await writeFile(source, contents, { mode: 0o600 });
  const sourceStat = await stat(source, { bigint: true });
  const probe = await open(source, 'r');
  const fileHandlePrototype = Object.getPrototypeOf(probe);
  const originalStat = fileHandlePrototype.stat;
  const originalWrite = fileHandlePrototype.write;
  await probe.close();
  const observedHandles = new Map();
  let closeCalls = 0;
  const wrapClose = (handle) => {
    if (observedHandles.has(handle)) return;
    const originalClose = handle.close;
    observedHandles.set(handle, originalClose);
    handle.close = async function failingClose(...args) {
      closeCalls += 1;
      const closeCall = closeCalls;
      const result = await originalClose.apply(this, args);
      if (closeCall === failingCloseCall)
        throw new Error(`simulated close failure ${failingCloseCall}`);
      return result;
    };
  };
  fileHandlePrototype.stat = function trackedStat(...args) {
    wrapClose(this);
    return originalStat.apply(this, args);
  };
  fileHandlePrototype.write = function trackedWrite(...args) {
    wrapClose(this);
    return originalWrite.apply(this, args);
  };

  try {
    await assert.rejects(
      copyExternalNoFollow({
        source,
        destination,
        identity: {
          device: String(sourceStat.dev),
          inode: String(sourceStat.ino),
        },
        expectedSha256: sha256(contents),
        maxBytes: 1024,
      }),
      new RegExp(`simulated close failure ${failingCloseCall}`)
    );
    assert.equal(closeCalls, 2);
    await assert.rejects(readFile(destination), { code: 'ENOENT' });
  } finally {
    fileHandlePrototype.stat = originalStat;
    fileHandlePrototype.write = originalWrite;
    await Promise.allSettled(
      [...observedHandles].map(([handle, originalClose]) =>
        originalClose.call(handle)
      )
    );
  }
}

test('copies a stable external input using bigint stat timestamps', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-input-copy-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  await chmod(root, 0o700);
  const source = join(root, 'source');
  const destination = join(root, 'destination');
  const contents = 'sealed external input';
  await writeFile(source, contents, { mode: 0o600 });
  const sourceStat = await stat(source, { bigint: true });

  const result = await copyExternalNoFollow({
    source,
    destination,
    identity: { device: String(sourceStat.dev), inode: String(sourceStat.ino) },
    expectedSha256: sha256(contents),
    maxBytes: 1024,
  });

  assert.deepEqual(result, {
    destination,
    sha256: sha256(contents),
    bytes: Buffer.byteLength(contents),
  });
  assert.equal(await readFile(destination, 'utf8'), contents);
});

test('retries a partial FileHandle write until the destination is complete', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-input-copy-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  await chmod(root, 0o700);
  const source = join(root, 'source');
  const destination = join(root, 'destination');
  const contents = 'partial output writes must be completed before success';
  await writeFile(source, contents, { mode: 0o600 });
  const sourceStat = await stat(source, { bigint: true });
  const probe = await open(source, 'r');
  const fileHandlePrototype = Object.getPrototypeOf(probe);
  const originalWrite = fileHandlePrototype.write;
  await probe.close();
  let writes = 0;
  fileHandlePrototype.write = function shortWrite(
    buffer,
    offset,
    length,
    position
  ) {
    writes += 1;
    return originalWrite.call(
      this,
      buffer,
      offset,
      Math.min(length, 1),
      position
    );
  };

  try {
    await copyExternalNoFollow({
      source,
      destination,
      identity: {
        device: String(sourceStat.dev),
        inode: String(sourceStat.ino),
      },
      expectedSha256: sha256(contents),
      maxBytes: 1024,
    });
    assert.ok(writes > 1);
    assert.equal(await readFile(destination, 'utf8'), contents);
  } finally {
    fileHandlePrototype.write = originalWrite;
  }
});

test('uses bigint stat metadata to verify mutation-safe timestamps', async () => {
  const source = await readFile(
    new URL('./install-input-copy.mjs', import.meta.url),
    'utf8'
  );
  assert.match(source, /input\.stat\(\{ bigint: true \}\)/);
  assert.match(source, /Number\.isSafeInteger\(size\)/);
  assert.match(source, /after\.mtimeNs !== before\.mtimeNs/);
  assert.match(source, /after\.ctimeNs !== before\.ctimeNs/);
});

test('refuses an existing destination without deleting the pre-existing bytes', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-input-copy-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  await chmod(root, 0o700);
  const source = join(root, 'source');
  const destination = join(root, 'destination');
  await writeFile(source, 'owner input', { mode: 0o600 });
  await writeFile(destination, 'do not replace', { mode: 0o600 });
  const info = await stat(source, { bigint: true });

  await assert.rejects(
    copyExternalNoFollow({
      source,
      destination,
      identity: { device: String(info.dev), inode: String(info.ino) },
      expectedSha256: sha256('owner input'),
      maxBytes: 1024,
    }),
    /EEXIST/
  );
  assert.equal(await readFile(destination, 'utf8'), 'do not replace');
});

test('settles both handles and removes the destination when either close fails', async (context) => {
  await assertCloseFailureCleanup(context, 1);
  await assertCloseFailureCleanup(context, 2);
});
