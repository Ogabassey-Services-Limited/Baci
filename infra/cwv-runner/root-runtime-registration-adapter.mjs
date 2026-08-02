import { execFile as execFileCallback } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { canonicalJson } from './canonical-json.mjs';
import { syncRegistrationAuthorityParent } from './registration-authority-parent-sync.mjs';
import { prepareRegistrationCommand } from './registration-command-prepare.mjs';
import {
  publishRegistrationCommand,
  readCompletedRegistrationCommand,
  readRegistrationCommandIfPresent,
  registrationCommandStoreRoot,
  registrationCompletedCommandRoot,
} from './registration-command-store.mjs';
import {
  publishRegistrationRetryBlock,
  readRegistrationRetryBlock,
} from './registration-retry-block.mjs';
import {
  createRegistrationRuntimeAuthority,
  prepareRegistrationRuntimeContract,
} from './registration-runtime-contract.mjs';
import {
  readRegistrationTerminalReceipt,
  readRegistrationTerminalState,
} from './registration-terminal-receipt.mjs';
import { readInstalledRuntimeReceipt } from './root-runtime-installed-receipt.mjs';
import { readRootRuntimeOwnedFile } from './root-runtime-owned-read.mjs';

const execFile = promisify(execFileCallback);
const ROOT = '/srv/baci-cwv';
const CAMPAIGNS = `${ROOT}/campaigns`;
const SEALED = `${ROOT}/sealed`;
const ACTIVE = `${registrationCommandStoreRoot}/active`;
const AUTHORITY = `${registrationCommandStoreRoot}/authority.json`;
const ARCHIVE = registrationCompletedCommandRoot;
const SHA256 = /^[a-f0-9]{64}$/;
const fail = () => {
  throw new TypeError('root runtime registration adapter refused');
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
// biome-ignore format: fixed root authority guard remains deliberately compact.
const root = () => { if (process.getuid?.() !== 0) fail(); };
const directory = (value) =>
  value?.isDirectory?.() &&
  !value.isSymbolicLink?.() &&
  value.uid === 0 &&
  value.gid === 0 &&
  (value.mode & 0o777) === 0o700;
const authorityBytes = (value) => Buffer.from(canonicalJson(value));
async function writeAuthority(bytes, dependencies) {
  const assertRoot = dependencies.assertRoot ?? root;
  const stat = dependencies.lstat ?? lstat;
  const makeDirectory = dependencies.mkdir ?? mkdir;
  const openFile = dependencies.open ?? open;
  const move = dependencies.rename ?? rename;
  const entropy = dependencies.randomBytes ?? randomBytes;
  if (typeof assertRoot !== 'function') fail();
  assertRoot();
  if (!Buffer.isBuffer(bytes) || bytes.length < 3 || bytes.length > 1024)
    fail();
  await makeDirectory(registrationCommandStoreRoot, {
    mode: 0o700,
    recursive: true,
  });
  if (!directory(await stat(registrationCommandStoreRoot))) fail();
  try {
    const existing = await readRootRuntimeOwnedFile(
      AUTHORITY,
      1024,
      dependencies
    );
    if (!existing.equals(bytes)) fail();
    await syncRegistrationAuthorityParent(
      registrationCommandStoreRoot,
      dependencies
    );
    return;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const nonce = entropy(16);
  if (!Buffer.isBuffer(nonce) || nonce.length !== 16) fail();
  const temporary = `${registrationCommandStoreRoot}/.authority-${nonce.toString('hex')}`;
  const handle = await openFile(
    temporary,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o400
  );
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await move(temporary, AUTHORITY);
  await syncRegistrationAuthorityParent(
    registrationCommandStoreRoot,
    dependencies
  );
}
export async function archiveActive(input, dependencies) {
  const stat = dependencies.lstat ?? lstat;
  const move = dependencies.rename ?? rename;
  const remove = dependencies.unlink ?? unlink;
  const assertRoot = dependencies.assertRoot ?? root;
  const { campaignId, commandBytes } = input;
  assertRoot();
  if (!Buffer.isBuffer(commandBytes)) fail();
  try {
    if (directory(await stat(ARCHIVE))) {
      const active = await readRegistrationCommandIfPresent(dependencies);
      const completed = await readCompletedRegistrationCommand(dependencies);
      const command = JSON.parse(completed.toString('utf8'));
      if (
        active !== undefined ||
        !completed.equals(commandBytes) ||
        command.context?.campaignId !== campaignId
      )
        fail();
      try {
        const authority = canonicalAuthority(
          await readRootRuntimeOwnedFile(AUTHORITY, 1024, dependencies)
        );
        if (authority.campaignId !== campaignId) fail();
        await remove(AUTHORITY);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      return;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await move(ACTIVE, ARCHIVE);
  try {
    await remove(AUTHORITY);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
function canonicalAuthority(bytes) {
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail();
  }
  if (
    canonicalJson(value) !== bytes.toString('utf8') ||
    value?.schemaVersion !== 1 ||
    !/^[a-z0-9][a-z0-9-]{0,62}$/.test(value.campaignId) ||
    !['registrationNonce', 'releaseNonce', 'stagingNonce'].every((key) =>
      /^[a-f0-9]{32}$/.test(value[key])
    ) ||
    new Set([value.registrationNonce, value.releaseNonce, value.stagingNonce])
      .size !== 3
  )
    fail();
  return value;
}
function fixedResult(result) {
  if (typeof result?.stdout !== 'string' || result.stderr !== '') fail();
  return result.stdout;
}
export function createInstalledRegistrationPreparationAdapter(
  dependencies = {}
) {
  const run = dependencies.executeFile ?? execFile;
  const prepare =
    dependencies.prepareRegistrationCommand ?? prepareRegistrationCommand;
  if (typeof run !== 'function' || typeof prepare !== 'function') fail();
  const persistedAuthority = async () => {
    try {
      return authorityBytes(
        canonicalAuthority(
          await readRootRuntimeOwnedFile(AUTHORITY, 1024, dependencies)
        )
      );
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      return undefined;
    }
  };
  const authority = async () => {
    const persisted = await persistedAuthority();
    if (persisted !== undefined) return canonicalAuthority(persisted);
    try {
      const command = JSON.parse(
        (await readCompletedRegistrationCommand(dependencies)).toString('utf8')
      );
      return canonicalAuthority(
        authorityBytes({
          campaignId: command.context?.campaignId,
          registrationNonce: command.context?.registrationNonce,
          releaseNonce: command.context?.releaseNonce,
          schemaVersion: 1,
          stagingNonce: command.context?.stagingNonce,
        })
      );
    } catch {
      fail();
    }
  };
  const campaignFile = async (name, maximum = 131_072) => {
    const current = await authority();
    return await readRootRuntimeOwnedFile(
      join(CAMPAIGNS, current.campaignId, name),
      maximum,
      dependencies
    );
  };
  const storedCommand = async () =>
    (await readRegistrationCommandIfPresent(dependencies)) ??
    (await readCompletedRegistrationCommand(dependencies));
  const quiesce = async ({ campaignId, mode }) => {
    if (mode !== 'registration') fail();
    fixedResult(await run(`${SEALED}/campaign-quiesce.sh`, [mode, campaignId]));
  };
  const readRuntimeReceipt = async () =>
    await readInstalledRuntimeReceipt({ dependencies, fail, root: ROOT });
  const finalization = async () => {
    const [command, current, terminal, state] = await Promise.all([
      storedCommand(),
      authority(),
      readRegistrationTerminalReceipt(dependencies),
      readRegistrationTerminalState(dependencies),
    ]);
    if (
      state.registrationComplete !== true ||
      terminal === undefined ||
      !SHA256.test(terminal.receipt.cleanupSha256)
    )
      fail();
    return Buffer.from(
      canonicalJson({
        campaignId: current.campaignId,
        cleanupSha256: terminal.receipt.cleanupSha256,
        commandSha256: digest(command),
        disposition: 'registered',
        schemaVersion: 1,
      })
    );
  };
  const commandDependencies = Object.freeze({
    archiveCommand: async ({ campaignId, commandBytes }) =>
      await archiveActive({ campaignId, commandBytes }, dependencies),
    createAuthority: () => createRegistrationRuntimeAuthority(),
    deriveCommand: prepareRegistrationRuntimeContract,
    persistCampaignAuthority: async (bytes) =>
      await writeAuthority(bytes, dependencies),
    publishCommand: async (bytes) =>
      await publishRegistrationCommand(bytes, dependencies),
    publishRetryBlock: async (value) =>
      await publishRegistrationRetryBlock(value, dependencies),
    quiesceRegistration: quiesce,
    readCampaign: async () => authorityBytes(await authority()),
    readCapture: async () => await campaignFile('capture.json'),
    readCaptureDigest: async () => await campaignFile('capture.sha256', 65),
    readCommand: storedCommand,
    readExistingCommand: async () =>
      await readRegistrationCommandIfPresent(dependencies),
    readPersistedAuthority: persistedAuthority,
    readFinalization: finalization,
    readImageReceipt: async () =>
      await readRootRuntimeOwnedFile(
        `${ROOT}/image-receipt.json`,
        131_072,
        dependencies
      ),
    readLease: async () => await campaignFile('lease-holder.json'),
    readPhase: async () => await campaignFile('phase.json'),
    readPolicy: async () =>
      await readRootRuntimeOwnedFile(
        `${SEALED}/policy.json`,
        131_072,
        dependencies
      ),
    readPostEgressRecovery: async () => undefined,
    readRetryBlock: async () => await readRegistrationRetryBlock(dependencies),
    readRuntimeReceipt,
    readWatchdog: async () => await campaignFile('watchdog-ready.json'),
    reconcileCommand: async () => undefined,
  });
  return async (command, additions = {}) => {
    if (
      additions === null ||
      typeof additions !== 'object' ||
      Array.isArray(additions)
    )
      fail();
    return await prepare(command, { ...commandDependencies, ...additions });
  };
}
