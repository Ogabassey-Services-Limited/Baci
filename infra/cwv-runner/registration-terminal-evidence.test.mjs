import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { canonicalJson } from './canonical-json.mjs';
import {
  assertRegistrationTerminalEvidence,
  readRegistrationTerminalEvidence,
} from './registration-terminal-evidence.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const context = Object.freeze({
  campaignId: 'registration-01',
  captureSha256: 'a'.repeat(64),
  imageDigest: `sha256:${'b'.repeat(64)}`,
  registrationNonce: 'c'.repeat(32),
  releaseNonce: 'd'.repeat(32),
});
const releaseSha256 = 'e'.repeat(64);
const registration = Object.freeze({
  captureSha256: context.captureSha256,
  cleanupSha256: 'f'.repeat(64),
  registrationComplete: true,
  imageDigest: context.imageDigest,
  registrationReleaseSha256: releaseSha256,
  runnerIdentitySha256: '1'.repeat(64),
});
const resource = Object.freeze({
  contentSha256: releaseSha256,
  dev: 7,
  ino: 8,
  mode: 0o440,
  relative: `${context.releaseNonce}/handoff/release.json`,
  root: '/run/baci-cwv-registration-release',
  rootDev: 7,
  rootIno: 8,
  schemaVersion: 1,
  type: 'file',
  uid: 0,
});
const row = Object.freeze({
  action: 'registration-release-created',
  captureSha256: context.captureSha256,
  mode: 'registration',
  previousSha256: '2'.repeat(64),
  resource,
  resourceIdentitySha256: digest(canonicalJson(resource)),
  schemaVersion: 1,
  sequence: 3,
  transactionId: context.campaignId,
});
const bytes = Buffer.from(`${canonicalJson(row)}\n`);
const name = `000003-${digest(bytes)}.json`;
const detail = (type, mode, size, ino) => ({
  dev: 7,
  gid: 0,
  ino,
  isDirectory: () => type === 'directory',
  isFile: () => type === 'file',
  isSymbolicLink: () => false,
  mode,
  nlink: 1,
  size,
  uid: 0,
});

function dependencies(body = bytes) {
  const root = '/campaigns';
  const journal = `${root}/${context.campaignId}/journal`;
  return {
    assertRoot: () => undefined,
    campaignRoot: root,
    lstat: (path) =>
      path === journal
        ? detail('directory', 0o40700, 0, 3)
        : detail('file', 0o100600, body.length, 4),
    open: async () => ({
      close: async () => undefined,
      read: (target, offset, length, position) => {
        const count = Math.max(0, Math.min(length, body.length - position));
        body.copy(target, offset, position, position + count);
        return { bytesRead: count };
      },
      stat: async () => detail('file', 0o100600, body.length, 4),
    }),
    readPostEgressRelease: (input) => {
      assert.deepEqual(input, {
        campaignId: context.campaignId,
        imageDigest: context.imageDigest,
        registrationNonce: context.registrationNonce,
      });
      return {
        captureSha256: context.captureSha256,
        imageDigest: context.imageDigest,
      };
    },
    readdir: async () => [name],
  };
}

test('reads the one root-owned release-created journal digest bound to current configuration', async () => {
  assert.deepEqual(
    await readRegistrationTerminalEvidence(context, dependencies()),
    {
      captureSha256: context.captureSha256,
      imageDigest: context.imageDigest,
      registrationReleaseSha256: releaseSha256,
    }
  );
});

test('rejects stale image, capture, release, or identity terminal combinations', () => {
  const evidence = {
    captureSha256: context.captureSha256,
    imageDigest: context.imageDigest,
    registrationReleaseSha256: releaseSha256,
  };
  assert.doesNotThrow(() =>
    assertRegistrationTerminalEvidence(registration, evidence)
  );
  for (const stale of [
    { ...registration, imageDigest: `sha256:${'9'.repeat(64)}` },
    { ...registration, captureSha256: '9'.repeat(64) },
    { ...registration, registrationReleaseSha256: '9'.repeat(64) },
    { ...registration, runnerIdentitySha256: 'not-a-digest' },
  ])
    assert.throws(
      () => assertRegistrationTerminalEvidence(stale, evidence),
      /registration terminal evidence refused/
    );
});

test('fails closed when release evidence has zero, multiple, or mismatched journal rows', async () => {
  for (const names of [[], [name, name]]) {
    const input = dependencies();
    input.readdir = async () => names;
    await assert.rejects(
      () => readRegistrationTerminalEvidence(context, input),
      /registration terminal evidence refused/
    );
  }
  const altered = Buffer.from(
    `${canonicalJson({ ...row, resource: { ...resource, contentSha256: '9'.repeat(64) } })}\n`
  );
  await assert.rejects(
    () => readRegistrationTerminalEvidence(context, dependencies(altered)),
    /registration terminal evidence refused/
  );
});
