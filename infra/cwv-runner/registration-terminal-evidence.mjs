import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import { readPostEgressRelease } from './registration-post-egress-recovery.mjs';

const ROOT = '/srv/baci-cwv/campaigns';
const SHA256 = /^[a-f0-9]{64}$/;
const IMAGE = /^sha256:[a-f0-9]{64}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const NONCE = /^[a-f0-9]{32}$/;
const JOURNAL = /^(\d{6})-([a-f0-9]{64})\.json$/;
const TERMINAL_KEYS = [
  'captureSha256',
  'cleanupSha256',
  'imageDigest',
  'registrationComplete',
  'registrationReleaseSha256',
  'runnerIdentitySha256',
];
const fail = () => {
  throw new TypeError('registration terminal evidence refused');
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exact = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const directory = (value) =>
  value?.isDirectory?.() &&
  !value.isSymbolicLink?.() &&
  value.uid === 0 &&
  value.gid === 0 &&
  (value.mode & 0o777) === 0o700;
const file = (value) =>
  value?.isFile?.() &&
  !value.isSymbolicLink?.() &&
  value.uid === 0 &&
  value.gid === 0 &&
  value.nlink === 1 &&
  (value.mode & 0o777) === 0o600 &&
  value.size > 1 &&
  value.size <= 131_072;
const same = (left, right) =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.size === right.size &&
  left.mode === right.mode &&
  left.uid === right.uid &&
  left.gid === right.gid &&
  left.nlink === right.nlink;

function expected(value) {
  if (
    !exact(value, [
      'campaignId',
      'captureSha256',
      'imageDigest',
      'registrationNonce',
      'releaseNonce',
    ]) ||
    !ID.test(value.campaignId) ||
    !SHA256.test(value.captureSha256) ||
    !IMAGE.test(value.imageDigest) ||
    !NONCE.test(value.registrationNonce) ||
    !NONCE.test(value.releaseNonce)
  )
    fail();
  return Object.freeze({ ...value });
}

async function readOwned(path, dependencies) {
  const stat = dependencies.lstat ?? lstat;
  const openFile = dependencies.open ?? open;
  const before = await stat(path);
  if (!file(before)) fail();
  const handle = await openFile(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    const opened = await handle.stat();
    if (!file(opened) || !same(before, opened)) fail();
    const bytes = Buffer.allocUnsafe(opened.size);
    for (let offset = 0; offset < bytes.length; ) {
      const result = await handle.read(
        bytes,
        offset,
        bytes.length - offset,
        offset
      );
      if (!Number.isInteger(result?.bytesRead) || result.bytesRead <= 0) fail();
      offset += result.bytesRead;
    }
    if (
      (await handle.read(Buffer.alloc(1), 0, 1, opened.size))?.bytesRead !== 0
    )
      fail();
    if (!same(opened, await handle.stat())) fail();
    return bytes;
  } finally {
    await handle.close();
  }
}

function releaseRow(bytes, name, input) {
  const match = JOURNAL.exec(name);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail();
  }
  const resource = value?.resource;
  if (
    !match ||
    digest(bytes) !== match[2] ||
    `${canonicalJson(value)}\n` !== bytes.toString('utf8') ||
    !exact(value, [
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
    value.action !== 'registration-release-created' ||
    value.captureSha256 !== input.captureSha256 ||
    value.mode !== 'registration' ||
    value.transactionId !== input.campaignId ||
    value.schemaVersion !== 1 ||
    value.sequence !== Number(match[1]) ||
    !SHA256.test(value.previousSha256) ||
    value.resourceIdentitySha256 !== digest(canonicalJson(resource)) ||
    !exact(resource, [
      'contentSha256',
      'dev',
      'ino',
      'mode',
      'relative',
      'root',
      'rootDev',
      'rootIno',
      'schemaVersion',
      'type',
      'uid',
    ]) ||
    !SHA256.test(resource.contentSha256) ||
    resource.root !== '/run/baci-cwv-registration-release' ||
    resource.relative !== `${input.releaseNonce}/handoff/release.json` ||
    resource.schemaVersion !== 1 ||
    resource.type !== 'file' ||
    resource.uid !== 0 ||
    resource.mode !== 0o440 ||
    !['dev', 'ino', 'rootDev', 'rootIno'].every(
      (key) => Number.isSafeInteger(resource[key]) && resource[key] >= 0
    )
  )
    fail();
  return resource.contentSha256;
}

export function assertRegistrationTerminalEvidence(registration, evidence) {
  if (
    !exact(registration, TERMINAL_KEYS) ||
    registration.registrationComplete !== true ||
    ![
      'captureSha256',
      'cleanupSha256',
      'registrationReleaseSha256',
      'runnerIdentitySha256',
    ].every((key) => SHA256.test(registration[key])) ||
    !IMAGE.test(registration.imageDigest) ||
    !exact(evidence, [
      'captureSha256',
      'imageDigest',
      'registrationReleaseSha256',
    ]) ||
    !SHA256.test(evidence.captureSha256) ||
    !IMAGE.test(evidence.imageDigest) ||
    !SHA256.test(evidence.registrationReleaseSha256) ||
    registration.captureSha256 !== evidence.captureSha256 ||
    registration.imageDigest !== evidence.imageDigest ||
    registration.registrationReleaseSha256 !==
      evidence.registrationReleaseSha256
  )
    fail();
  return Object.freeze({ ...evidence });
}

export function terminalServiceRegistration(registration, evidence) {
  const absent = {
    captureSha256: null,
    cleanupSha256: null,
    imageDigest: null,
    registrationComplete: false,
    registrationReleaseSha256: null,
    runnerIdentitySha256: null,
  };
  if (!exact(registration, TERMINAL_KEYS)) fail();
  if (registration.registrationComplete === false) {
    if (
      canonicalJson(registration) !== canonicalJson(absent) ||
      evidence !== null
    )
      fail();
    return Object.freeze({
      registrationComplete: false,
      runnerIdentitySha256: null,
    });
  }
  assertRegistrationTerminalEvidence(registration, evidence);
  return Object.freeze({
    registrationComplete: true,
    runnerIdentitySha256: registration.runnerIdentitySha256,
  });
}

export async function readRegistrationTerminalEvidence(
  input,
  dependencies = {}
) {
  const verified = expected(input);
  const root = dependencies.campaignRoot ?? ROOT;
  const readRelease =
    dependencies.readPostEgressRelease ?? readPostEgressRelease;
  const stat = dependencies.lstat ?? lstat;
  const list = dependencies.readdir ?? readdir;
  if (typeof root !== 'string' || typeof readRelease !== 'function') fail();
  const release = await readRelease(
    {
      campaignId: verified.campaignId,
      imageDigest: verified.imageDigest,
      registrationNonce: verified.registrationNonce,
    },
    dependencies
  );
  const journal = join(root, verified.campaignId, 'journal');
  if (
    !release ||
    release.captureSha256 !== verified.captureSha256 ||
    release.imageDigest !== verified.imageDigest ||
    !directory(await stat(journal))
  )
    fail();
  const names = await list(journal);
  if (!Array.isArray(names) || names.some((name) => typeof name !== 'string'))
    fail();
  const matches = [];
  for (const name of names) {
    if (!JOURNAL.test(name)) fail();
    const bytes = await readOwned(join(journal, name), dependencies);
    let row;
    try {
      row = JSON.parse(bytes.toString('utf8'));
    } catch {
      fail();
    }
    if (row?.action === 'registration-release-created')
      matches.push(releaseRow(bytes, name, verified));
  }
  if (matches.length !== 1) fail();
  const stable = await readRelease(
    {
      campaignId: verified.campaignId,
      imageDigest: verified.imageDigest,
      registrationNonce: verified.registrationNonce,
    },
    dependencies
  );
  if (!stable || stable.captureSha256 !== verified.captureSha256) fail();
  return Object.freeze({
    captureSha256: verified.captureSha256,
    imageDigest: verified.imageDigest,
    registrationReleaseSha256: matches[0],
  });
}
