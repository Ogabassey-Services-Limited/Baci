import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import path from 'node:path';
import { recordJournalEntry } from './campaign-state.mjs';
import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';
import { assertRegistrationTokenMount } from './registration-token-mount.mjs';

const IDENTITY = Object.freeze({ gid: 10001, mode: 0o400, uid: 10001 });
const fail = () => {
  throw new TypeError('registration root receipt refused');
};
const STATE_ROOT = '/srv/baci-cwv/campaigns';
// biome-ignore format: fixed receipt definitions preserve the executable line cap
const TERMINAL = Object.freeze({
  'registration-release-layout-created': Object.freeze({ gid: 10001, mode: 0o750, mutable: false, root: '/run/baci-cwv-registration-release', type: 'tree', uid: 0 }),
  'registration-release-created': Object.freeze({ gid: 10001, mode: 0o440, mutable: false, root: '/run/baci-cwv-registration-release', type: 'file', uid: 0 }),
  'registration-staging-created': Object.freeze({ gid: 10001, mode: 0o700, mutable: true, root: '/srv/baci-cwv/registration-staging', type: 'tree', uid: 10001 }),
  'registration-token-created': Object.freeze({ gid: 10001, mode: 0o440, mutable: false, root: '/run/baci-cwv-registration', tmpfs: true, type: 'file', uid: 0 }),
  'registration-token-layout-created': Object.freeze({ gid: 0, mode: 0o700, mutable: false, root: '/run/baci-cwv-registration', tmpfs: true, type: 'tree', uid: 0 }),
});
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// biome-ignore format: fixed unmount receipt preserves the file-size gate
export function registrationTokenUnmountReceipt(namespaceMounts, tokenParentFilesystem) {
  let normalized;
  try { normalized = canonicalJson(namespaceMounts); } catch { fail(); }
  if (
    namespaceMounts === null ||
    typeof namespaceMounts !== 'object' ||
    normalized.includes('/run/secrets/runner-registration-token') ||
    !['absent', 'tmpfs\n'].includes(tokenParentFilesystem)
  )
    fail();
  return Object.freeze({ tokenUnmountSha256: canonicalSha256({ namespaceMounts, schemaVersion: 1, tokenParentFilesystem: tokenParentFilesystem === 'absent' ? 'absent' : 'tmpfs' }) });
}
async function secureRead(path, maximum, dependencies) {
  const stat = dependencies.lstat ?? lstat;
  const openFile = dependencies.open ?? open;
  const before = await stat(path);
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.uid !== IDENTITY.uid ||
    before.gid !== IDENTITY.gid ||
    (before.mode & 0o777) !== IDENTITY.mode ||
    before.size > maximum
  )
    fail();
  const handle = await openFile(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    const after = await handle.stat();
    if (
      !after.isFile() ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size > maximum
    )
      fail();
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}
export function createRegistrationReceiptOperations(
  _configuration,
  files,
  dependencies = {}
) {
  if (
    typeof files?.verifyRelease !== 'function' ||
    typeof files?.paths?.staging !== 'string'
  )
    fail();
  const wait =
    dependencies.wait ??
    ((milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const readEventually = async (path, maximum) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        return await secureRead(path, maximum, dependencies);
      } catch {
        if (attempt === 99) fail();
        await wait(100);
      }
    }
    fail();
  };
  return Object.freeze({
    async waitReady() {
      const value = await readEventually(
        `${files.paths.staging}/registration-ready.sha256`,
        65
      );
      const markerSha256 = value.toString('utf8').trimEnd();
      if (
        value.toString('utf8') !== `${markerSha256}\n` ||
        !/^[a-f0-9]{64}$/.test(markerSha256)
      )
        fail();
      return {
        registrationReadySha256: canonicalSha256({
          markerSha256,
          schemaVersion: 1,
        }),
      };
    },
    async waitReleaseReadOnce() {
      const bytes = await readEventually(
        `${files.paths.staging}/release-read-once.json`,
        128
      );
      let value;
      try {
        value = JSON.parse(bytes.toString('utf8'));
      } catch {
        fail();
      }
      if (
        bytes.toString('utf8') !==
          `{"reads":1,"sha256":"${value?.sha256}"}\n` ||
        !/^[a-f0-9]{64}$/.test(value?.sha256)
      )
        fail();
      await files.verifyRelease(value.sha256);
      return value;
    },
    async validateOutput() {
      const bytes = await secureRead(
        `${files.paths.staging}/registration-output.json`,
        128,
        dependencies
      );
      if (
        bytes.toString('utf8') !==
        '{"runnerRelativePath":"actions-runner","schemaVersion":1}\n'
      )
        fail();
      return {};
    },
  });
}

async function inspectTerminal(pathname, flags, dependencies) {
  const handle = await (dependencies.open ?? open)(pathname, flags);
  try {
    const details = await handle.stat();
    return {
      bytes: details.isFile() ? await handle.readFile() : Buffer.alloc(0),
      details,
    };
  } finally {
    await handle.close();
  }
}

export async function captureRegistrationTerminalReceipt(
  action,
  target,
  dependencies = {}
) {
  const definition = TERMINAL[action];
  if (!definition || typeof target !== 'string') fail();
  const relative = path.relative(definition.root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    fail();
  const directoryFlag = constants.O_DIRECTORY ?? 0;
  const mountRelative = relative.split('/')[0];
  const mountTarget = path.join(definition.root, mountRelative);
  if (definition.tmpfs && !/^[a-f0-9]{32}$/.test(mountRelative)) fail();
  const [root, resource] = await Promise.all([
    inspectTerminal(
      definition.root,
      constants.O_RDONLY | constants.O_NOFOLLOW | directoryFlag,
      dependencies
    ),
    inspectTerminal(
      target,
      constants.O_RDONLY |
        constants.O_NOFOLLOW |
        (definition.type === 'tree' ? directoryFlag : 0),
      dependencies
    ),
  ]);
  const mount =
    definition.tmpfs === true
      ? await inspectTerminal(
          mountTarget,
          constants.O_RDONLY | constants.O_NOFOLLOW | directoryFlag,
          dependencies
        )
      : undefined;
  const rootDetails = root.details;
  const details = resource.details;
  if (
    !rootDetails.isDirectory() ||
    rootDetails.isSymbolicLink?.() ||
    rootDetails.uid !== 0 ||
    rootDetails.gid !== 0 ||
    (rootDetails.mode & 0o077) !== 0 ||
    details.isSymbolicLink?.() ||
    (definition.type === 'file' ? !details.isFile() : !details.isDirectory()) ||
    (definition.tmpfs !== true && details.dev !== rootDetails.dev) ||
    details.uid !== definition.uid ||
    details.gid !== definition.gid ||
    (details.mode & 0o777) !== definition.mode
  )
    fail();
  const mountIdentity =
    definition.tmpfs === true
      ? await assertRegistrationTokenMount(
          mountTarget,
          mount.details,
          dependencies
        )
      : undefined;
  if (
    (definition.tmpfs === true &&
      (mountIdentity.dev === rootDetails.dev ||
        details.dev !== mountIdentity.dev ||
        (definition.type === 'tree' && details.ino !== mountIdentity.ino))) ||
    (definition.tmpfs === true && resource.details.isSymbolicLink?.())
  )
    fail();
  return Object.freeze({
    schemaVersion: 1,
    root: definition.root,
    rootDev: rootDetails.dev,
    rootIno: rootDetails.ino,
    relative,
    type: definition.type,
    dev: details.dev,
    ino: details.ino,
    uid: details.uid,
    mode: definition.mode,
    contentSha256: sha256(resource.bytes),
    ...(definition.tmpfs === true
      ? {
          mountDev: mountIdentity.dev,
          mountIno: mountIdentity.ino,
          mountRelative,
        }
      : {}),
    ...(definition.mutable ? { mutable: true } : {}),
  });
}

export function createRegistrationResourceJournal(
  configuration,
  files,
  dependencies = {}
) {
  const context = configuration?.context;
  const paths = files?.paths;
  const capture =
    dependencies.captureTerminalReceipt ?? captureRegistrationTerminalReceipt;
  const record = dependencies.recordJournalEntry ?? recordJournalEntry;
  if (
    !/^[a-z0-9][a-z0-9-]{0,62}$/.test(context?.campaignId) ||
    !/^[a-f0-9]{32}$/.test(context?.registrationNonce) ||
    !paths ||
    typeof capture !== 'function' ||
    typeof record !== 'function'
  )
    fail();
  const terminal = async (action, target) =>
    record({
      action,
      resource: await capture(action, target),
      root: STATE_ROOT,
      transactionId: context.campaignId,
    });
  return Object.freeze({
    containerCreated: ({ containerId }) =>
      record({
        action: 'registration-container-created',
        resource: {
          containerId,
          imageDigest: context.imageDigest,
          name: `baci-cwv-registration-${context.registrationNonce}`,
          schemaVersion: 1,
          transactionId: context.campaignId,
        },
        root: STATE_ROOT,
        transactionId: context.campaignId,
      }),
    releaseCreated: () =>
      terminal('registration-release-created', paths.release),
    releaseLayoutCreated: () =>
      terminal('registration-release-layout-created', paths.handoff),
    stagingCreated: () =>
      terminal('registration-staging-created', paths.staging),
    tokenCreated: () => terminal('registration-token-created', paths.token),
    tokenLayoutCreated: () =>
      terminal('registration-token-layout-created', paths.tokenParent),
  });
}
