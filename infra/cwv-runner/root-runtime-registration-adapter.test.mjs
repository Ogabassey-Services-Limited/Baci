import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  archiveActive,
  createInstalledRegistrationPreparationAdapter,
} from './root-runtime-registration-adapter.mjs';

const command = Buffer.from(
  '{"context":{"campaignId":"registration-01"},"resources":{},"schemaVersion":2}'
);
const commandSha = createHash('sha256').update(command).digest('hex');
const archivedCommand = Buffer.from(
  '{"context":{"campaignId":"registration-01","registrationNonce":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","releaseNonce":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","stagingNonce":"cccccccccccccccccccccccccccccccc"},"resources":{},"schemaVersion":2}'
);
const archivedCommandSha = createHash('sha256')
  .update(archivedCommand)
  .digest('hex');
const directory = () => ({
  gid: 0,
  isDirectory: () => true,
  isSymbolicLink: () => false,
  mode: 0o40700,
  uid: 0,
});
const file = (size) => ({
  dev: 1,
  gid: 0,
  ino: 2,
  isFile: () => true,
  isSymbolicLink: () => false,
  mode: 0o100400,
  nlink: 1,
  size,
  uid: 0,
});

test('supplies every preparation dependency from one installed adapter boundary', async () => {
  let dependencies;
  const prepare = createInstalledRegistrationPreparationAdapter({
    executeFile: async () => ({ stderr: '', stdout: '' }),
    prepareRegistrationCommand: (command, value) => {
      dependencies = value;
      return command;
    },
  });

  assert.equal(await prepare('begin'), 'begin');
  for (const name of [
    'archiveCommand',
    'createAuthority',
    'deriveCommand',
    'persistCampaignAuthority',
    'publishCommand',
    'publishRetryBlock',
    'quiesceRegistration',
    'readCampaign',
    'readCapture',
    'readCaptureDigest',
    'readCommand',
    'readExistingCommand',
    'readPersistedAuthority',
    'readFinalization',
    'readImageReceipt',
    'readLease',
    'readPhase',
    'readPolicy',
    'readPostEgressRecovery',
    'readRetryBlock',
    'readRuntimeReceipt',
    'readWatchdog',
    'reconcileCommand',
  ])
    assert.equal(typeof dependencies[name], 'function', name);
});

test('refuses a non-function installed command preparation boundary', () => {
  assert.throws(
    () =>
      createInstalledRegistrationPreparationAdapter({ executeFile: 'refused' }),
    /root runtime registration adapter refused/
  );
});

test('refuses non-object recovery additions before they reach preparation', async () => {
  const prepare = createInstalledRegistrationPreparationAdapter({
    executeFile: async () => ({ stderr: '', stdout: '' }),
    prepareRegistrationCommand: async () => undefined,
  });
  await assert.rejects(
    prepare('recover', []),
    /root runtime registration adapter refused/
  );
});

test('removes same-campaign authority after a completed archive rename crash', async () => {
  const authority = Buffer.from(
    '{"campaignId":"registration-01","registrationNonce":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","releaseNonce":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","schemaVersion":1,"stagingNonce":"cccccccccccccccccccccccccccccccc"}'
  );
  const files = new Map([
    [
      '/srv/baci-cwv/receipts/root-runtime-command/archive/command.json',
      command,
    ],
    [
      '/srv/baci-cwv/receipts/root-runtime-command/archive/command.sha256',
      Buffer.from(`${commandSha}\n`),
    ],
    ['/srv/baci-cwv/receipts/root-runtime-command/authority.json', authority],
  ]);
  const missing = (path) => {
    const error = new Error(path);
    error.code = 'ENOENT';
    throw error;
  };
  const dependencies = {
    assertRoot: () => undefined,
    lstat: (path) => {
      if (path.endsWith('/active')) return missing(path);
      if (path.endsWith('root-runtime-command') || path.endsWith('/archive'))
        return directory();
      const value = files.get(path);
      return value ? file(value.length) : missing(path);
    },
    open: (path) => {
      const value = files.get(path);
      return {
        close: () => undefined,
        read: (target, offset, length, position) => {
          const count = Math.min(length, Math.max(0, value.length - position));
          value.copy(target, offset, position, position + count);
          return { bytesRead: count };
        },
        readFile: () => value,
        stat: () => file(value.length),
      };
    },
    unlink: (path) => files.delete(path),
  };
  await archiveActive(
    { campaignId: 'registration-01', commandBytes: command },
    dependencies
  );
  assert.equal(
    files.has('/srv/baci-cwv/receipts/root-runtime-command/authority.json'),
    false
  );
});

test('installed adapter finalizes an archived command through archiveActive same-command proof', async () => {
  const files = new Map([
    [
      '/srv/baci-cwv/receipts/root-runtime-command/archive/command.json',
      archivedCommand,
    ],
    [
      '/srv/baci-cwv/receipts/root-runtime-command/archive/command.sha256',
      Buffer.from(`${archivedCommandSha}\n`),
    ],
  ]);
  const missing = (path) => {
    const error = new Error(path);
    error.code = 'ENOENT';
    throw error;
  };
  const dependencies = {
    assertRoot: () => undefined,
    executeFile: async () => ({ stderr: '', stdout: '' }),
    lstat: (path) => {
      if (path.endsWith('/active') || path.endsWith('/authority.json'))
        return missing(path);
      if (path.endsWith('root-runtime-command') || path.endsWith('/archive'))
        return directory();
      const value = files.get(path);
      return value ? file(value.length) : missing(path);
    },
    open: (path) => {
      const value = files.get(path);
      return {
        close: () => undefined,
        read: (target, offset, length, position) => {
          const count = Math.min(length, Math.max(0, value.length - position));
          value.copy(target, offset, position, position + count);
          return { bytesRead: count };
        },
        stat: () => file(value.length),
      };
    },
    unlink: () => undefined,
  };
  const receipt = {
    campaignId: 'registration-01',
    cleanupSha256: '4'.repeat(64),
    commandSha256: archivedCommandSha,
    disposition: 'registered',
    schemaVersion: 1,
  };
  const result = await createInstalledRegistrationPreparationAdapter(
    dependencies
  )('finalize', {
    readFinalization: async () => Buffer.from(JSON.stringify(receipt)),
  });
  assert.deepEqual(result, receipt);
});
