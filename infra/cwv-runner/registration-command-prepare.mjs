import { createHash } from 'node:crypto';
import { readRegistrationCaptureAuthority } from './campaign-capture-authority.mjs';
import { canonicalJson } from './canonical-json.mjs';
import {
  readRegistrationRetryBlockReceipt,
  validateRegistrationCapture,
  validateRegistrationCaptureDigest,
  validateRegistrationCaptureReceipt,
} from './registration-command-retry-block.mjs';
import {
  publishRegistrationCommand,
  readRegistrationCommand,
  readRegistrationCommandIfPresent,
} from './registration-command-store.mjs';
import { readRegistrationRetryBlock } from './registration-retry-block.mjs';
import {
  createRegistrationRuntimeAuthority,
  prepareRegistrationRuntimeContract,
} from './registration-runtime-contract.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const COMMANDS = new Set(['begin', 'recover', 'finalize']);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// biome-ignore format: fixed rejection keeps the sealed source under its cap
const fail = (message) => { throw new TypeError(`registration command prepare refused: ${message}`); };
const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
function parse(bytes, label) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 2 || bytes.length > 131_072)
    fail(`${label} bytes`);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(`${label} JSON`);
  }
  return value;
}
function canonical(bytes, label) {
  const value = parse(bytes, label);
  if (canonicalJson(value) !== bytes.toString('utf8'))
    fail(`${label} canonical`);
  return value;
}
function authority(bytes) {
  const value = canonical(bytes, 'campaign authority');
  const missing = [
    'campaignId',
    'registrationNonce',
    'releaseNonce',
    'schemaVersion',
    'stagingNonce',
  ].filter((key) => !Object.hasOwn(value, key));
  if (missing.length) fail(`campaign authority missing: ${missing.join(', ')}`);
  if (
    value.schemaVersion !== 1 ||
    !/^[a-z0-9][a-z0-9-]{0,62}$/.test(value.campaignId) ||
    !['registrationNonce', 'releaseNonce', 'stagingNonce'].every((key) =>
      /^[a-f0-9]{32}$/.test(value[key])
    ) ||
    new Set([value.registrationNonce, value.releaseNonce, value.stagingNonce])
      .size !== 3
  )
    fail('campaign authority shape');
  return value;
}
function command(bytes, campaignId) {
  const value = canonical(bytes, 'command');
  if (
    value.schemaVersion !== 2 ||
    !isObject(value.context) ||
    value.context.campaignId !== campaignId ||
    !isObject(value.resources)
  )
    fail('schema-v2 command');
  return value;
}

function requireFunction(dependencies, name, fallback) {
  const value = dependencies[name] ?? fallback;
  if (typeof value !== 'function') fail(`${name} interface`);
  return value;
}

async function rejectRetryBlock(dependencies) {
  const block = await requireFunction(
    dependencies,
    'readRetryBlock',
    readRegistrationRetryBlock
  )();
  if (block !== undefined) fail('owner row deletion required');
}

async function begin(dependencies) {
  await rejectRetryBlock(dependencies);
  const existing = await requireFunction(
    dependencies,
    'readExistingCommand',
    readRegistrationCommandIfPresent
  )();
  if (existing !== undefined) return await recover(dependencies);
  const createAuthority = requireFunction(
    dependencies,
    'createAuthority',
    createRegistrationRuntimeAuthority
  );
  const persist = requireFunction(dependencies, 'persistCampaignAuthority');
  const quiesce = requireFunction(dependencies, 'quiesceRegistration');
  const readCampaign = requireFunction(dependencies, 'readCampaign');
  const readDigest = requireFunction(dependencies, 'readCaptureDigest');
  const readPhase = requireFunction(dependencies, 'readPhase');
  const readWatchdog = requireFunction(dependencies, 'readWatchdog');
  const readLease = requireFunction(dependencies, 'readLease');
  const derive = requireFunction(
    dependencies,
    'deriveCommand',
    prepareRegistrationRuntimeContract
  );
  const publish = requireFunction(
    dependencies,
    'publishCommand',
    publishRegistrationCommand
  );
  const readPersisted = dependencies.readPersistedAuthority;
  if (readPersisted !== undefined && typeof readPersisted !== 'function')
    fail('readPersistedAuthority interface');
  const persistedBytes =
    readPersisted === undefined ? undefined : await readPersisted();
  const expected =
    persistedBytes === undefined
      ? authority(Buffer.from(canonicalJson(createAuthority())))
      : authority(persistedBytes);
  if (persistedBytes === undefined)
    await persist(Buffer.from(canonicalJson(expected)));
  await quiesce({ campaignId: expected.campaignId, mode: 'registration' });
  const campaignBytes = await readCampaign();
  const persisted = authority(campaignBytes);
  if (canonicalJson(persisted) !== canonicalJson(expected))
    fail('campaign authority drift');
  const captureDigest = await readDigest();
  const expectedSha256 = captureDigest.toString('utf8').trimEnd();
  const readCapture =
    dependencies.readCapture ??
    (() =>
      readRegistrationCaptureAuthority({
        expectedSha256,
        root: '/srv/baci-cwv/campaigns',
        transactionId: expected.campaignId,
      }));
  if (typeof readCapture !== 'function') fail('readCapture interface');
  const captureBytes = await readCapture();
  validateRegistrationCapture({
    bytes: captureBytes,
    canonical: canonicalJson,
    fail,
    parse,
  });
  validateRegistrationCaptureDigest({
    bytes: captureDigest,
    captureBytes,
    fail,
  });
  const phase = canonical(await readPhase(), 'phase');
  if (phase.phase !== 'active') fail('active phase');
  const captureSha256 = sha256(captureBytes);
  for (const [name, read] of [
    ['watchdog', readWatchdog],
    ['lease', readLease],
  ])
    validateRegistrationCaptureReceipt({
      bytes: await read(),
      campaignId: expected.campaignId,
      canonical,
      captureSha256,
      fail,
      name,
    });
  const result = await derive({
    readCampaign,
    readCapture,
    readImageReceipt: requireFunction(dependencies, 'readImageReceipt'),
    readPolicy: requireFunction(dependencies, 'readPolicy'),
    readRuntimeReceipt: requireFunction(dependencies, 'readRuntimeReceipt'),
  });
  const bytes = Buffer.from(canonicalJson(result));
  const verified = command(bytes, expected.campaignId);
  await publish(bytes);
  return Object.freeze(verified);
}

async function recover(dependencies) {
  const readRetryBlock = requireFunction(
    dependencies,
    'readRetryBlock',
    readRegistrationRetryBlock
  );
  if ((await readRetryBlock()) !== undefined)
    fail('owner row deletion required');
  const persisted = authority(
    await requireFunction(dependencies, 'readCampaign')()
  );
  const bytes = await requireFunction(
    dependencies,
    'readCommand',
    readRegistrationCommand
  )();
  const verified = command(bytes, persisted.campaignId);
  const readRecovery = dependencies.readPostEgressRecovery;
  if (readRecovery !== undefined) {
    if (typeof readRecovery !== 'function')
      fail('readPostEgressRecovery interface');
    const recovery = await readRecovery();
    if (recovery !== undefined) {
      const block = readRegistrationRetryBlockReceipt({
        bytes: recovery,
        campaignId: persisted.campaignId,
        canonical,
        commandSha256: sha256(bytes),
        fail,
        isObject,
      });
      const publish = requireFunction(dependencies, 'publishRetryBlock');
      const published = await publish(block);
      if (canonicalJson(published) !== canonicalJson(block))
        fail('retry block publish drift');
      const reread = await readRetryBlock();
      if (canonicalJson(reread) !== canonicalJson(block))
        fail('retry block reread drift');
      await requireFunction(
        dependencies,
        'archiveCommand'
      )({
        campaignId: persisted.campaignId,
        command: verified,
        commandBytes: Buffer.from(bytes),
        receipt: block,
      });
      fail('owner row deletion required');
    }
  }
  const reconcile = requireFunction(dependencies, 'reconcileCommand');
  await reconcile({ command: verified, commandBytes: Buffer.from(bytes) });
  return Object.freeze(verified);
}

export async function finalizeRegistrationCommand(dependencies = {}) {
  const persisted = authority(
    await requireFunction(dependencies, 'readCampaign')()
  );
  const bytes = await requireFunction(
    dependencies,
    'readCommand',
    readRegistrationCommand
  )();
  const verified = command(bytes, persisted.campaignId);
  const receiptValue = canonical(
    await requireFunction(dependencies, 'readFinalization')(),
    'finalization receipt'
  );
  if (
    receiptValue.schemaVersion !== 1 ||
    receiptValue.campaignId !== persisted.campaignId ||
    receiptValue.commandSha256 !== sha256(bytes) ||
    !SHA256.test(receiptValue.cleanupSha256) ||
    typeof receiptValue.disposition !== 'string' ||
    !/^[a-z][a-z-]{0,63}$/.test(receiptValue.disposition)
  )
    fail('finalization binding');
  await requireFunction(
    dependencies,
    'archiveCommand'
  )({
    campaignId: persisted.campaignId,
    command: verified,
    commandBytes: Buffer.from(bytes),
    receipt: receiptValue,
  });
  return Object.freeze(receiptValue);
}

export async function prepareRegistrationCommand(
  commandName,
  dependencies = {}
) {
  if (!COMMANDS.has(commandName)) fail('fixed command');
  if (!isObject(dependencies)) fail('dependencies');
  if (commandName === 'begin') return await begin(dependencies);
  if (commandName === 'recover') return await recover(dependencies);
  return await finalizeRegistrationCommand(dependencies);
}
