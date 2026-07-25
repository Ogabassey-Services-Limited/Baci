import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import test from 'node:test';
import { syncRegistrationAuthorityParent } from './registration-authority-parent-sync.mjs';
import { createInstalledRegistrationPreparationAdapter } from './root-runtime-registration-adapter.mjs';

const authority = Buffer.from(
  '{"campaignId":"registration-01","registrationNonce":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","releaseNonce":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","schemaVersion":1,"stagingNonce":"cccccccccccccccccccccccccccccccc"}'
);
const directory = (ino = 2) => ({
  dev: 1,
  gid: 0,
  ino,
  isDirectory: () => true,
  isSymbolicLink: () => false,
  mode: 0o40700,
  uid: 0,
});
const missing = (path) => {
  const error = new Error(path);
  error.code = 'ENOENT';
  throw error;
};

test('durably syncs the authority parent before a command can publish', async () => {
  const events = [];
  const prepare = createInstalledRegistrationPreparationAdapter({
    assertRoot: () => events.push('root'),
    lstat: (path) =>
      path.endsWith('root-runtime-command') ? directory() : missing(path),
    mkdir: async () => events.push('mkdir'),
    open: (path, flags) => {
      if (path.endsWith('root-runtime-command')) {
        assert.equal(
          flags,
          constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
        );
        return {
          close: async () => events.push('directory-close'),
          stat: async () => directory(),
          sync: async () => events.push('directory-sync'),
        };
      }
      assert.match(path, /\.authority-[a-f0-9]{32}$/);
      return {
        close: async () => events.push('temporary-close'),
        sync: async () => events.push('temporary-sync'),
        writeFile: async () => events.push('temporary-write'),
      };
    },
    prepareRegistrationCommand: async (_command, dependencies) => {
      await dependencies.persistCampaignAuthority(authority);
      events.push('command-publish');
    },
    randomBytes: () => Buffer.alloc(16, 1),
    rename: async () => events.push('authority-rename'),
  });

  await prepare('begin');
  assert.deepEqual(events, [
    'root',
    'mkdir',
    'temporary-write',
    'temporary-sync',
    'temporary-close',
    'authority-rename',
    'directory-sync',
    'directory-close',
    'command-publish',
  ]);
});

test('refuses command publication when authority-parent sync fails', async () => {
  const prepare = createInstalledRegistrationPreparationAdapter({
    assertRoot: () => undefined,
    lstat: (path) =>
      path.endsWith('root-runtime-command') ? directory() : missing(path),
    mkdir: async () => undefined,
    open: async (path) =>
      path.endsWith('root-runtime-command')
        ? {
            close: async () => undefined,
            stat: async () => directory(),
            sync: () => {
              throw new Error('simulated power loss');
            },
          }
        : {
            close: async () => undefined,
            sync: async () => undefined,
            writeFile: async () => undefined,
          },
    prepareRegistrationCommand: async (_command, dependencies) => {
      await dependencies.persistCampaignAuthority(authority);
      throw new Error('command must not publish');
    },
    randomBytes: () => Buffer.alloc(16, 2),
    rename: async () => undefined,
  });

  await assert.rejects(
    prepare('begin'),
    /root runtime registration adapter refused/
  );
});

test('retries the authority-parent sync before reusing identical durable bytes', async () => {
  const events = [];
  const file = {
    dev: 1,
    gid: 0,
    ino: 3,
    isFile: () => true,
    isSymbolicLink: () => false,
    mode: 0o100400,
    nlink: 1,
    size: authority.length,
    uid: 0,
  };
  const prepare = createInstalledRegistrationPreparationAdapter({
    assertRoot: () => undefined,
    lstat: (path) =>
      path.endsWith('root-runtime-command') ? directory() : file,
    mkdir: async () => undefined,
    open: async (path) =>
      path.endsWith('root-runtime-command')
        ? {
            close: async () => events.push('directory-close'),
            stat: async () => directory(),
            sync: async () => events.push('directory-sync'),
          }
        : {
            close: async () => undefined,
            read: (target, offset, length, position) => {
              const count = Math.min(
                length,
                Math.max(0, authority.length - position)
              );
              authority.copy(target, offset, position, position + count);
              return { bytesRead: count };
            },
            stat: async () => file,
          },
    prepareRegistrationCommand: async (_command, dependencies) => {
      await dependencies.persistCampaignAuthority(authority);
      events.push('command-publish');
    },
  });

  await prepare('begin');
  assert.deepEqual(events, [
    'directory-sync',
    'directory-close',
    'command-publish',
  ]);
});

test('refuses a root-directory metadata change while syncing authority', async () => {
  let calls = 0;
  await assert.rejects(
    syncRegistrationAuthorityParent('/root-runtime-command', {
      lstat: async () => directory(),
      open: async () => ({
        close: async () => undefined,
        stat: async () => directory(++calls === 2 ? 3 : 2),
        sync: async () => undefined,
      }),
    }),
    /root runtime registration adapter refused/
  );
});
