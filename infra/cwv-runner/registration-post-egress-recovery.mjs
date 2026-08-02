import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir } from 'node:fs/promises';
import path from 'node:path';

import { canonicalJson } from './canonical-json.mjs';

const CAMPAIGNS = '/srv/baci-cwv/campaigns';
const SHA256 = /^[a-f0-9]{64}$/;
const JOURNAL = /^(\d{6})-([a-f0-9]{64})\.json$/;
const fail = () => {
  throw new TypeError('post-egress recovery refused');
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const root = () => {
  if (process.getuid?.() !== 0) fail();
};
const directory = (value) =>
  value?.isDirectory?.() &&
  !value.isSymbolicLink?.() &&
  value.uid === 0 &&
  value.gid === 0 &&
  (value.mode & 0o777) === 0o700;
const file = (value, maximum) =>
  value?.isFile?.() &&
  !value.isSymbolicLink?.() &&
  value.uid === 0 &&
  value.gid === 0 &&
  value.nlink === 1 &&
  (value.mode & 0o777) === 0o600 &&
  value.size > 0 &&
  value.size <= maximum;
const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');

function campaign(value) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(value)) fail();
  return value;
}

function canonical(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 2 || bytes.length > 131_072)
    fail();
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail();
  }
  if (`${canonicalJson(value)}\n` !== bytes.toString('utf8')) fail();
  return value;
}

async function secureDirectory(target, stat) {
  let value;
  try {
    value = await stat(target);
  } catch {
    fail();
  }
  if (!directory(value)) fail();
}

async function secureRead(target, maximum, stat, openFile) {
  let before;
  try {
    before = await stat(target);
  } catch {
    fail();
  }
  if (!file(before, maximum)) fail();
  let handle;
  try {
    handle = await openFile(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    const during = await handle.stat();
    if (
      !file(during, maximum) ||
      during.dev !== before.dev ||
      during.ino !== before.ino
    )
      fail();
    const bytes = await handle.readFile();
    if (!Buffer.isBuffer(bytes) || bytes.length !== before.size) fail();
    await handle.sync();
    const after = await stat(target);
    if (
      !file(after, maximum) ||
      after.dev !== before.dev ||
      after.ino !== before.ino
    )
      fail();
    return bytes;
  } catch (error) {
    if (error instanceof TypeError) throw error;
    fail();
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function capture(bytes, campaignId) {
  const value = canonical(bytes);
  if (
    value?.schemaVersion !== 1 ||
    value.transactionId !== campaignId ||
    value.mode !== 'registration'
  )
    fail();
  return value;
}

function entry(bytes, name, sequence, previous, campaignId, captureSha256) {
  const value = canonical(bytes);
  const match = JOURNAL.exec(name);
  if (
    !match ||
    Number(match[1]) !== sequence ||
    match[2] !== sha256(bytes) ||
    value?.schemaVersion !== 1 ||
    !exactKeys(value, [
      'action',
      'captureSha256',
      'mode',
      'previousSha256',
      'resource',
      'resourceIdentitySha256',
      'schemaVersion',
      'sequence',
      'transactionId',
    ]) ||
    value.sequence !== sequence ||
    value.previousSha256 !== previous ||
    value.transactionId !== campaignId ||
    value.mode !== 'registration' ||
    value.captureSha256 !== captureSha256 ||
    value.resourceIdentitySha256 !== sha256(canonicalJson(value.resource))
  )
    fail();
  return Object.freeze({ ...value, sha256: match[2] });
}

function releaseEvidence(row, created, input, captureSha256) {
  if (
    row.action !== 'registration-egress-released' ||
    canonicalJson(row.resource) !==
      canonicalJson({
        activeEgressRuleSha256: row.resource?.activeEgressRuleSha256,
        schemaVersion: 1,
      }) ||
    !SHA256.test(row.resource?.activeEgressRuleSha256)
  )
    fail();
  const expectedName = `baci-cwv-registration-${input.registrationNonce}`;
  if (
    !created ||
    canonicalJson(created.resource) !==
      canonicalJson({
        containerId: created.resource?.containerId,
        imageDigest: input.imageDigest,
        name: expectedName,
        schemaVersion: 1,
        transactionId: input.campaignId,
      }) ||
    !SHA256.test(created.resource?.containerId)
  )
    fail();
  return Object.freeze({
    activeEgressRuleSha256: row.resource.activeEgressRuleSha256,
    campaignId: input.campaignId,
    captureSha256,
    containerId: created.resource.containerId,
    egressReleaseSha256: row.sha256,
    imageDigest: input.imageDigest,
    name: expectedName,
    schemaVersion: 1,
  });
}

export async function readPostEgressRelease(input, dependencies = {}) {
  const assertRoot = dependencies.assertRoot ?? root;
  const stat = dependencies.lstat ?? lstat;
  const openFile = dependencies.open ?? open;
  const list = dependencies.readdir ?? readdir;
  const campaignRoot = dependencies.campaignRoot ?? CAMPAIGNS;
  const campaignId = campaign(input?.campaignId);
  if (
    typeof assertRoot !== 'function' ||
    typeof stat !== 'function' ||
    typeof openFile !== 'function' ||
    typeof list !== 'function' ||
    typeof campaignRoot !== 'string' ||
    path.basename(campaignRoot) !== 'campaigns'
  )
    fail();
  if (
    !/^sha256:[a-f0-9]{64}$/.test(input?.imageDigest) ||
    !/^[a-f0-9]{32}$/.test(input?.registrationNonce)
  )
    fail();
  assertRoot();
  const transaction = path.join(campaignRoot, campaignId);
  const journal = path.join(transaction, 'journal');
  await secureDirectory(campaignRoot, stat);
  await secureDirectory(transaction, stat);
  await secureDirectory(journal, stat);
  const captureBytes = await secureRead(
    path.join(transaction, 'capture.json'),
    131_072,
    stat,
    openFile
  );
  const captureShaBytes = await secureRead(
    path.join(transaction, 'capture.sha256'),
    65,
    stat,
    openFile
  );
  const captureSha256 = captureShaBytes.toString('utf8').slice(0, -1);
  if (
    captureShaBytes.toString('utf8') !== `${captureSha256}\n` ||
    !SHA256.test(captureSha256) ||
    sha256(captureBytes) !== captureSha256
  )
    fail();
  capture(captureBytes, campaignId);
  let names;
  try {
    names = await list(journal);
  } catch {
    fail();
  }
  if (!Array.isArray(names) || names.some((name) => typeof name !== 'string'))
    fail();
  names.sort();
  if (names.some((name) => !JOURNAL.test(name))) fail();
  let previous = null;
  let release;
  let created;
  for (const [index, name] of names.entries()) {
    const row = entry(
      await secureRead(path.join(journal, name), 131_072, stat, openFile),
      name,
      index + 1,
      previous,
      campaignId,
      captureSha256
    );
    if (row.action.startsWith('registration-egress-')) {
      if (row.action !== 'registration-egress-released' || release) fail();
      release = releaseEvidence(row, created, input, captureSha256);
    }
    if (row.action.startsWith('registration-container-')) {
      if (row.action !== 'registration-container-created' || created || release)
        fail();
      created = row;
    }
    previous = row.sha256;
  }
  return release;
}
