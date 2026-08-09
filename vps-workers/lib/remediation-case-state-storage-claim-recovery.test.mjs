import assert from 'node:assert/strict';
import {
  linkSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createRemediationCaseStateStorage } from './remediation-case-state-storage.mjs';

const nowMs = Date.parse('2026-08-09T10:05:00.000Z');
const staleAtMs = nowMs - 3 * 60 * 1_000;
const lockToken = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const claimToken = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const owner = (pid, token, processStartedAt) => ({
  createdAt: '2026-08-09T10:00:00.000Z',
  pid,
  ...(processStartedAt ? { processStartedAt } : {}),
  token,
});

const writeOwner = (path, value) => {
  const ownerPath = `${path}.owner-${value.token}`;
  writeFileSync(ownerPath, JSON.stringify(value));
  return ownerPath;
};

const createClaimResidue = ({ claimContent, claimOwner, claimMtimeMs }) => {
  const directory = mkdtempSync(join(tmpdir(), 'baci-case-storage-claim-'));
  const path = join(directory, 'state.json');
  const lockPath = `${path}.lock`;
  const lockOwnerPath = writeOwner(lockPath, owner(101, lockToken));
  linkSync(lockOwnerPath, lockPath);
  const claimPath = `${lockPath}.reclaim-${lockToken}`;
  if (claimOwner) {
    const claimOwnerPath = writeOwner(lockPath, claimOwner);
    linkSync(claimOwnerPath, claimPath);
  } else {
    writeFileSync(claimPath, claimContent);
  }
  utimesSync(claimPath, claimMtimeMs / 1_000, claimMtimeMs / 1_000);
  return { claimPath, directory, path };
};

const runClaimCase = ({
  claimContent,
  claimMtimeMs = staleAtMs,
  claimOwner,
  processIsAlive,
  processStartedAt,
}) => {
  const fixture = createClaimResidue({
    claimContent,
    claimMtimeMs,
    claimOwner,
  });
  let actions = 0;
  const storage = createRemediationCaseStateStorage({
    createEmptyState: () => ({ version: 1 }),
    isValidState: (state) => state?.version === 1,
    path: fixture.path,
    processIsAlive,
    processStartedAt,
  });
  const result = storage.withLock(nowMs, 'busy', () => {
    actions += 1;
    return 'recovered';
  });
  return { ...fixture, actions, result };
};

const readFileNames = (directory) => readdirSync(directory);

describe('remediation case state storage claim recovery', () => {
  it('keeps a complete live claimant busy', () => {
    const fixture = runClaimCase({
      claimOwner: owner(202, claimToken, 'live-process'),
      processIsAlive: (pid) => pid === 202,
      processStartedAt: () => 'live-process',
    });

    assert.equal(fixture.result, 'busy');
    assert.equal(fixture.actions, 0);
    assert.equal(
      JSON.parse(readFileSync(fixture.claimPath, 'utf8')).token,
      claimToken
    );
  });

  it('reclaims a complete dead claimant with one action and no remnants', () => {
    const fixture = runClaimCase({
      claimOwner: owner(202, claimToken),
      processIsAlive: () => false,
      processStartedAt: () => null,
    });

    assert.equal(fixture.result, 'recovered');
    assert.equal(fixture.actions, 1);
    assert.deepEqual(readFileNames(fixture.directory), []);
  });

  it('reclaims a complete PID-reused claimant with one action and no remnants', () => {
    const fixture = runClaimCase({
      claimOwner: owner(202, claimToken, 'original-process'),
      processIsAlive: (pid) => pid === 202,
      processStartedAt: (pid) => (pid === 202 ? 'replacement-process' : null),
    });

    assert.equal(fixture.result, 'recovered');
    assert.equal(fixture.actions, 1);
    assert.deepEqual(readFileNames(fixture.directory), []);
  });

  it('keeps a recent malformed claimant busy', () => {
    const fixture = runClaimCase({
      claimContent: '{not json',
      claimMtimeMs: nowMs,
      processIsAlive: () => false,
      processStartedAt: () => null,
    });

    assert.equal(fixture.result, 'busy');
    assert.equal(fixture.actions, 0);
    assert.equal(readFileSync(fixture.claimPath, 'utf8'), '{not json');
  });

  it('keeps a recent ownerless claimant busy', () => {
    const fixture = runClaimCase({
      claimContent: '',
      claimMtimeMs: nowMs,
      processIsAlive: () => false,
      processStartedAt: () => null,
    });

    assert.equal(fixture.result, 'busy');
    assert.equal(fixture.actions, 0);
    assert.equal(readFileSync(fixture.claimPath, 'utf8'), '');
  });

  it('reclaims an aged malformed claimant with one action and no remnants', () => {
    const fixture = runClaimCase({
      claimContent: '{not json',
      processIsAlive: () => false,
      processStartedAt: () => null,
    });

    assert.equal(fixture.result, 'recovered');
    assert.equal(fixture.actions, 1);
    assert.deepEqual(readFileNames(fixture.directory), []);
  });

  it('reclaims an aged ownerless claimant with one action and no remnants', () => {
    const fixture = runClaimCase({
      claimContent: '',
      processIsAlive: () => false,
      processStartedAt: () => null,
    });

    assert.equal(fixture.result, 'recovered');
    assert.equal(fixture.actions, 1);
    assert.deepEqual(readFileNames(fixture.directory), []);
  });

  it('does not unlink a malformed claimant replaced between stable snapshots', () => {
    const fixture = createClaimResidue({
      claimContent: '{not json',
      claimMtimeMs: staleAtMs,
    });
    const replacement = '{replacement';
    let claimStatReads = 0;
    let actions = 0;
    const storage = createRemediationCaseStateStorage({
      createEmptyState: () => ({ version: 1 }),
      isValidState: (state) => state?.version === 1,
      path: fixture.path,
      processIsAlive: () => false,
      processStartedAt: () => null,
      stat(target, options) {
        if (target === fixture.claimPath && ++claimStatReads === 2) {
          unlinkSync(fixture.claimPath);
          writeFileSync(fixture.claimPath, replacement);
        }
        return statSync(target, options);
      },
    });

    assert.equal(
      storage.withLock(nowMs, 'busy', () => {
        actions += 1;
        return 'entered';
      }),
      'busy'
    );
    assert.equal(actions, 0);
    assert.equal(readFileSync(fixture.claimPath, 'utf8'), replacement);
  });

  it('does not reclaim a claim replaced after its second validation snapshot', () => {
    const fixture = createClaimResidue({
      claimContent: '{not json',
      claimMtimeMs: staleAtMs,
    });
    let claimStatReads = 0;
    let replacementDestroyed = false;
    const storage = createRemediationCaseStateStorage({
      createEmptyState: () => ({ version: 1 }),
      externallyLocked: true,
      isValidState: (state) => state?.version === 1,
      path: fixture.path,
      processIsAlive: () => false,
      processStartedAt: () => null,
      stat(target, options) {
        if (target === fixture.claimPath) claimStatReads += 1;
        return statSync(target, options);
      },
      unlink(target) {
        if (target === fixture.claimPath && claimStatReads === 2) {
          writeFileSync(target, '{replacement');
          replacementDestroyed = true;
        }
        unlinkSync(target);
      },
    });

    assert.equal(
      storage.withLock(nowMs, 'busy', () => 'entered'),
      'entered'
    );
    assert.equal(claimStatReads, 0);
    assert.equal(replacementDestroyed, false);
    assert.deepEqual(readFileNames(fixture.directory), []);
  });
});
