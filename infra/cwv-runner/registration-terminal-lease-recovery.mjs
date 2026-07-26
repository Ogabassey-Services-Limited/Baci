import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { join } from 'node:path';

import { canonicalJson } from './canonical-json.mjs';
import { readPostEgressRelease } from './registration-post-egress-recovery.mjs';

const fail = () => {
  throw new TypeError('root controller refused');
};
const exact = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const digest = (value) => /^[a-f0-9]{64}$/.test(value);
const retryTerminalKeys = [
  'captureSha256',
  'imageDigest',
  'registrationReleaseSha256',
  'runnerIdentitySha256',
  'sealedRunnerSha256',
];
const successTerminalKeys = [
  'captureSha256',
  'cleanupSha256',
  'imageDigest',
  'registrationComplete',
  'registrationReleaseSha256',
  'runnerIdentitySha256',
];

function classifyTerminal(terminal, context) {
  if (
    terminal?.captureSha256 !== context.captureSha256 ||
    terminal?.imageDigest !== context.imageDigest
  )
    fail();
  if (
    exact(terminal, retryTerminalKeys) &&
    [
      'registrationReleaseSha256',
      'runnerIdentitySha256',
      'sealedRunnerSha256',
    ].every((key) => digest(terminal[key]))
  )
    return terminal;
  if (
    exact(terminal, successTerminalKeys) &&
    terminal.registrationComplete === true &&
    [
      'cleanupSha256',
      'registrationReleaseSha256',
      'runnerIdentitySha256',
    ].every((key) => digest(terminal[key]))
  )
    return terminal;
  fail();
}

export async function readRestoredRegistration(context, dependencies) {
  const path = join(
    dependencies.campaignRoot ?? '/srv/baci-cwv/campaigns',
    context.campaignId,
    'restored.json'
  );
  const stat = dependencies.lstat ?? lstat;
  const openFile = dependencies.open ?? open;
  let before;
  try {
    before = await stat(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    fail();
  }
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.uid !== 0 ||
    before.gid !== 0 ||
    before.nlink !== 1 ||
    (before.mode & 0o777) !== 0o600 ||
    before.size < 3 ||
    before.size > 4096
  )
    fail();
  const handle = await openFile(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    const opened = await handle.stat();
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size
    )
      fail();
    const bytes = Buffer.allocUnsafe(opened.size);
    if (
      (await handle.read(bytes, 0, bytes.length, 0)).bytesRead !==
        bytes.length ||
      (await handle.read(Buffer.alloc(1), 0, 1, bytes.length)).bytesRead !== 0
    )
      fail();
    let value;
    try {
      value = JSON.parse(bytes.toString('utf8'));
    } catch {
      fail();
    }
    const terminal = value?.registrationTerminal;
    const residual = value?.residualState;
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      `${canonicalJson(value)}\n` !== bytes.toString('utf8') ||
      Object.keys(value).sort().join(',') !==
        'captureSha256,mode,policyFileSha256,progress,reconciled,registrationTerminal,residualState,schemaVersion,sourceDigest' ||
      value.schemaVersion !== 1 ||
      value.captureSha256 !== context.captureSha256 ||
      value.mode !== 'registration' ||
      value.reconciled !== true ||
      !digest(value.policyFileSha256) ||
      !digest(value.sourceDigest) ||
      value.progress === null ||
      typeof value.progress !== 'object' ||
      Array.isArray(value.progress) ||
      !exact(residual, [
        'accountingTablePresent',
        'cronSha256',
        'dedicatedNetworkPresent',
        'dedicatedServicesActive',
        'ownedFirewallPresent',
        'samplerActive',
        'transactionContainerCount',
      ]) ||
      residual.accountingTablePresent !== false ||
      residual.dedicatedNetworkPresent !== false ||
      residual.dedicatedServicesActive !== false ||
      residual.ownedFirewallPresent !== false ||
      residual.samplerActive !== false ||
      residual.transactionContainerCount !== 0 ||
      !digest(residual.cronSha256)
    )
      fail();
    return classifyTerminal(terminal, context);
  } finally {
    await handle.close();
  }
}

export async function releaseRetainedTerminalLease(
  configuration,
  execute,
  dependencies,
  terminal
) {
  const context = configuration.context;
  if (
    !exact(terminal, [
      'captureSha256',
      'cleanupSha256',
      'imageDigest',
      'registrationComplete',
      'registrationReleaseSha256',
      'runnerIdentitySha256',
    ]) ||
    terminal.registrationComplete !== true ||
    terminal.captureSha256 !== context.captureSha256 ||
    terminal.imageDigest !== context.imageDigest ||
    ![
      'cleanupSha256',
      'registrationReleaseSha256',
      'runnerIdentitySha256',
    ].every((key) => digest(terminal[key]))
  )
    fail();
  const release = await (
    dependencies.readPostEgressRelease ?? readPostEgressRelease
  )(
    {
      campaignId: context.campaignId,
      imageDigest: context.imageDigest,
      registrationNonce: context.registrationNonce,
    },
    dependencies.postEgressDependencies
  );
  const restored = await (
    dependencies.readRestoredRegistration ?? readRestoredRegistration
  )(
    {
      campaignId: context.campaignId,
      captureSha256: context.captureSha256,
      imageDigest: context.imageDigest,
    },
    dependencies.postEgressDependencies ?? dependencies
  );
  if (
    !exact(release, [
      'activeEgressRuleSha256',
      'campaignId',
      'captureSha256',
      'containerId',
      'egressReleaseSha256',
      'imageDigest',
      'name',
      'schemaVersion',
    ]) ||
    release.campaignId !== context.campaignId ||
    release.captureSha256 !== context.captureSha256 ||
    release.imageDigest !== context.imageDigest ||
    release.name !== `baci-cwv-registration-${context.registrationNonce}` ||
    release.schemaVersion !== 1 ||
    !['activeEgressRuleSha256', 'containerId', 'egressReleaseSha256'].every(
      (key) => digest(release[key])
    ) ||
    restored?.captureSha256 !== terminal.captureSha256 ||
    restored?.imageDigest !== terminal.imageDigest ||
    restored?.registrationReleaseSha256 !==
      terminal.registrationReleaseSha256 ||
    restored?.runnerIdentitySha256 !== terminal.runnerIdentitySha256
  )
    fail();
  const restoredCapture = await execute('restore-capture');
  if (
    !exact(restoredCapture, ['capture', 'schemaVersion']) ||
    restoredCapture.capture !== 'restored' ||
    restoredCapture.schemaVersion !== 1 ||
    !exact(await execute('release-lock'), [])
  )
    fail();
}
