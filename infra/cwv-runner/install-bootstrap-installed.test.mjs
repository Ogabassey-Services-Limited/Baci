import assert from 'node:assert/strict';
import {
  chmod,
  lstat,
  mkdtemp,
  open,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readInstalledProjection } from './install-bootstrap-installed.mjs';

const rootOwned = (details, patch = {}) => ({
  ...details,
  gid: 0,
  isFile: () => true,
  isSymbolicLink: () => false,
  uid: 0,
  ...patch,
});

const rootOwnedOpen = async (...arguments_) => {
  const handle = await open(...arguments_);
  return {
    close: () => handle.close(),
    read: (...readArguments) => handle.read(...readArguments),
    stat: async () => rootOwned(await handle.stat()),
  };
};

const pinnedHandle = (details, options = {}) => {
  const bytes = options.bytes ?? Buffer.from('installed');
  let closed = false;
  let statCalls = 0;
  return {
    close: () => {
      closed = true;
    },
    closed: () => closed,
    read: (target, offset, length, position) => {
      if (options.grow && position === bytes.length) {
        target[offset] = 1;
        return { bytesRead: 1 };
      }
      const available = Math.min(length, Math.max(0, bytes.length - position));
      const bytesRead =
        options.truncate && position === 0 ? available - 1 : available;
      bytes.copy(target, offset, position, position + bytesRead);
      return { bytesRead };
    },
    stat: async () =>
      statCalls++ === 0
        ? rootOwned(details, options.opened)
        : rootOwned(details, options.after),
  };
};

test('reads hashes, modes, and owners from the installed nonsymlink projection', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-installed-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'target');
  await writeFile(target, 'installed');
  await chmod(target, 0o640);
  const rootOwnedLstat = async (path) => {
    const details = await lstat(path);
    return {
      ...details,
      gid: 0,
      isFile: () => details.isFile(),
      isSymbolicLink: () => details.isSymbolicLink(),
      mode: details.mode,
      uid: 0,
    };
  };
  const files = await readInstalledProjection(
    { [target]: {} },
    { lstatFile: rootOwnedLstat, openFile: rootOwnedOpen }
  );
  assert.equal(files[target].mode, '0640');
  assert.equal(files[target].owner, 'root:root');
  await symlink(target, join(root, 'link'));
  await assert.rejects(
    () =>
      readInstalledProjection(
        { [join(root, 'link')]: {} },
        { lstatFile: rootOwnedLstat }
      ),
    /unsafe installed bootstrap path/
  );
});

test('refuses a path replaced by a symlink between validation and open', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-swap-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'target');
  const original = join(root, 'original');
  const attacker = join(root, 'attacker');
  await writeFile(target, 'installed');
  await writeFile(attacker, 'attacker');
  const swappingLstat = async (path) => {
    const details = await lstat(path);
    await rename(path, original);
    await symlink(attacker, path);
    return rootOwned(details);
  };

  await assert.rejects(() =>
    readInstalledProjection({ [target]: {} }, { lstatFile: swappingLstat })
  );
});

test('refuses truncated, growing, or inode-swapped installed files', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-pinned-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'target');
  await writeFile(target, 'installed');
  const details = await lstat(target);
  const lstatFile = async () => rootOwned(details);

  for (const options of [
    { truncate: true },
    { grow: true },
    { opened: { ino: details.ino + 1 } },
    { after: { ino: details.ino + 1 } },
    { after: { ctimeMs: details.ctimeMs + 1, mtimeMs: details.mtimeMs + 1 } },
  ]) {
    const handle = pinnedHandle(details, options);
    await assert.rejects(() =>
      readInstalledProjection(
        { [target]: {} },
        { lstatFile, openFile: async () => handle }
      )
    );
    assert.equal(handle.closed(), true);
  }
});

test('refuses size changes between pathname validation and descriptor open', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-size-swap-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'target');
  await writeFile(target, 'installed');
  const details = await lstat(target);
  const lstatFile = async () => rootOwned(details);

  for (const bytes of [Buffer.from('truncate'), Buffer.from('installed!')]) {
    const changed = { size: bytes.length };
    const handle = pinnedHandle(details, {
      after: changed,
      bytes,
      opened: changed,
    });
    await assert.rejects(() =>
      readInstalledProjection(
        { [target]: {} },
        { lstatFile, openFile: async () => handle }
      )
    );
    assert.equal(handle.closed(), true);
  }
});

test('closes the pinned installed-file descriptor after a successful read', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-close-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'target');
  await writeFile(target, 'installed');
  const details = await lstat(target);
  const handle = pinnedHandle(details);

  await readInstalledProjection(
    { [target]: {} },
    {
      lstatFile: async () => rootOwned(details),
      openFile: async () => handle,
    }
  );

  assert.equal(handle.closed(), true);
});

test('projects an absent installed path for interrupted first-install recovery', async () => {
  const missing = '/srv/baci-cwv/sealed/missing-bootstrap-file';
  const error = new Error('missing');
  error.code = 'ENOENT';

  assert.deepEqual(
    await readInstalledProjection(
      { [missing]: {} },
      {
        lstatFile: () => {
          throw error;
        },
      }
    ),
    { [missing]: { absent: true } }
  );
});
