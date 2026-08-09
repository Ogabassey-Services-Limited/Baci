import assert from 'node:assert/strict';
import {
  linkSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createRemediationCaseStateStorage } from './remediation-case-state-storage.mjs';

const nowMs = Date.parse('2026-08-09T10:05:00.000Z');
const lockToken = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const claimToken = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const writeOwner = ({ path, pid, token }) => {
  const ownerPath = `${path}.owner-${token}`;
  writeFileSync(
    ownerPath,
    JSON.stringify({
      createdAt: '2026-08-09T10:00:00.000Z',
      pid,
      token,
    })
  );
  return ownerPath;
};

const createClaimResidue = () => {
  const directory = mkdtempSync(join(tmpdir(), 'baci-case-storage-claim-'));
  const path = join(directory, 'state.json');
  const lockPath = `${path}.lock`;
  const lockOwnerPath = writeOwner({
    path: lockPath,
    pid: 101,
    token: lockToken,
  });
  linkSync(lockOwnerPath, lockPath);
  const claimOwnerPath = writeOwner({
    path: lockPath,
    pid: 202,
    token: claimToken,
  });
  linkSync(claimOwnerPath, `${lockPath}.reclaim-${lockToken}`);
  return { directory, lockPath, path };
};

describe('remediation case state storage claim recovery', () => {
  it('reclaims a dead claimant residue and runs the recovered action', () => {
    const { directory, path } = createClaimResidue();
    const storage = createRemediationCaseStateStorage({
      createEmptyState: () => ({ version: 1 }),
      isValidState: (state) => state?.version === 1,
      path,
      processIsAlive: () => false,
    });

    assert.equal(
      storage.withLock(nowMs, 'busy', () => 'recovered'),
      'recovered'
    );
    assert.deepEqual(readdirSync(directory), []);
  });

  it('does not steal a live claimant while the original lock owner is dead', () => {
    const { directory, lockPath, path } = createClaimResidue();
    const claimPath = `${lockPath}.reclaim-${lockToken}`;
    const storage = createRemediationCaseStateStorage({
      createEmptyState: () => ({ version: 1 }),
      isValidState: (state) => state?.version === 1,
      path,
      processIsAlive: (pid) => pid === 202,
    });

    assert.equal(
      storage.withLock(nowMs, 'busy', () => 'entered'),
      'busy'
    );
    assert.equal(JSON.parse(readFileSync(claimPath, 'utf8')).token, claimToken);
    assert.equal(
      readdirSync(directory).includes(claimPath.split('/').at(-1)),
      true
    );
  });
});
