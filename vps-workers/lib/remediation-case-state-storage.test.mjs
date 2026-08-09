import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createRemediationCaseStateStorage } from './remediation-case-state-storage.mjs';

describe('remediation case state storage', () => {
  it('atomically persists a validated lifecycle snapshot', () => {
    const path = join(
      mkdtempSync(join(tmpdir(), 'baci-case-storage-')),
      'state.json'
    );
    const storage = createRemediationCaseStateStorage({
      createEmptyState: () => ({ version: 1 }),
      isValidState: (state) => state?.version === 1,
      path,
    });

    storage.persist({ version: 1 });

    assert.deepEqual(storage.read(), { version: 1 });
    assert.equal(readFileSync(path, 'utf8'), '{\n  "version": 1\n}\n');
  });

  it('preserves the JSON parse error as the invalid-state cause', () => {
    const path = join(
      mkdtempSync(join(tmpdir(), 'baci-case-storage-parse-')),
      'state.json'
    );
    writeFileSync(path, '{not json');
    const storage = createRemediationCaseStateStorage({
      createEmptyState: () => ({ version: 1 }),
      isValidState: (state) => state?.version === 1,
      path,
    });

    assert.throws(
      () => storage.read(),
      (error) =>
        error.message.includes('Invalid remediation case state') &&
        error.cause instanceof SyntaxError
    );
  });

  it('removes its temporary snapshot when rename fails', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-case-storage-rename-'));
    const path = join(directory, 'state.json');
    mkdirSync(path);
    const storage = createRemediationCaseStateStorage({
      createEmptyState: () => ({ version: 1 }),
      isValidState: (state) => state?.version === 1,
      path,
    });

    assert.throws(() => storage.persist({ version: 1 }));
    assert.equal(existsSync(`${path}.${process.pid}.tmp`), false);
  });

  it('retries after a stale lock disappears during concurrent cleanup', () => {
    const path = join(
      mkdtempSync(join(tmpdir(), 'baci-case-storage-stale-')),
      'state.json'
    );
    const lockPath = `${path}.lock`;
    writeFileSync(
      lockPath,
      JSON.stringify({
        createdAt: '2026-08-09T10:00:00.000Z',
        pid: 2_147_483_647,
        token: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      })
    );
    const staleAt = Date.now() - 3 * 60 * 1_000;
    utimesSync(lockPath, staleAt / 1_000, staleAt / 1_000);
    let staleUnlink = true;
    const storage = createRemediationCaseStateStorage({
      createEmptyState: () => ({ version: 1 }),
      isValidState: (state) => state?.version === 1,
      path,
      unlink(target) {
        if (target === lockPath && staleUnlink) {
          staleUnlink = false;
          unlinkSync(target);
          const error = new Error('already removed');
          error.code = 'ENOENT';
          throw error;
        }
        unlinkSync(target);
      },
    });

    assert.deepEqual(
      storage.withLock(Date.now(), null, (state) => state),
      {
        version: 1,
      }
    );
  });

  it('recovers an aged empty lock when a worker crashes after opening it', () => {
    const path = join(
      mkdtempSync(join(tmpdir(), 'baci-case-storage-ownerless-')),
      'state.json'
    );
    const lockPath = `${path}.lock`;
    const nowMs = Date.parse('2026-08-09T10:05:00.000Z');
    writeFileSync(lockPath, '');
    const staleAt = nowMs - 3 * 60 * 1_000;
    utimesSync(lockPath, staleAt / 1_000, staleAt / 1_000);
    const storage = createRemediationCaseStateStorage({
      createEmptyState: () => ({ version: 1 }),
      isValidState: (state) => state?.version === 1,
      path,
    });

    assert.deepEqual(
      storage.withLock(nowMs, null, (state) => state),
      { version: 1 }
    );
    assert.equal(existsSync(lockPath), false);
  });

  it('keeps a recent partial lock busy while its owner metadata may still be written', () => {
    const path = join(
      mkdtempSync(join(tmpdir(), 'baci-case-storage-partial-lock-')),
      'state.json'
    );
    const lockPath = `${path}.lock`;
    const nowMs = Date.parse('2026-08-09T10:05:00.000Z');
    writeFileSync(lockPath, '{"createdAt":');
    utimesSync(lockPath, nowMs / 1_000, nowMs / 1_000);
    const storage = createRemediationCaseStateStorage({
      createEmptyState: () => ({ version: 1 }),
      isValidState: (state) => state?.version === 1,
      path,
    });

    assert.equal(
      storage.withLock(nowMs, 'busy', (state) => state),
      'busy'
    );
    assert.equal(readFileSync(lockPath, 'utf8'), '{"createdAt":');
  });

  it('recovers an aged partial lock with no usable owner identity', () => {
    const path = join(
      mkdtempSync(join(tmpdir(), 'baci-case-storage-partial-ownerless-')),
      'state.json'
    );
    const lockPath = `${path}.lock`;
    const nowMs = Date.parse('2026-08-09T10:05:00.000Z');
    writeFileSync(
      lockPath,
      JSON.stringify({
        createdAt: '2026-08-09T10:00:00.000Z',
      })
    );
    const staleAt = nowMs - 3 * 60 * 1_000;
    utimesSync(lockPath, staleAt / 1_000, staleAt / 1_000);
    const storage = createRemediationCaseStateStorage({
      createEmptyState: () => ({ version: 1 }),
      isValidState: (state) => state?.version === 1,
      path,
    });

    assert.deepEqual(
      storage.withLock(nowMs, null, (state) => state),
      { version: 1 }
    );
  });

  it('keeps an aged live lock when process start time cannot be read', () => {
    const path = join(
      mkdtempSync(join(tmpdir(), 'baci-case-storage-live-owner-')),
      'state.json'
    );
    const lockPath = `${path}.lock`;
    const nowMs = Date.parse('2026-08-09T10:05:00.000Z');
    writeFileSync(
      lockPath,
      JSON.stringify({
        createdAt: '2026-08-09T10:00:00.000Z',
        pid: 42,
        processStartedAt: 'live-process',
        token: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      })
    );
    const storage = createRemediationCaseStateStorage({
      createEmptyState: () => ({ version: 1 }),
      isValidState: (state) => state?.version === 1,
      path,
      processIsAlive: () => true,
      processStartedAt: () => null,
    });

    assert.equal(
      storage.withLock(nowMs, 'busy', (state) => state),
      'busy'
    );
    assert.equal(existsSync(lockPath), true);
  });

  it('does not remove a lock whose ownership changes before release', () => {
    const path = join(
      mkdtempSync(join(tmpdir(), 'baci-case-storage-owner-change-')),
      'state.json'
    );
    const lockPath = `${path}.lock`;
    const replacement = {
      createdAt: '2026-08-09T10:05:00.000Z',
      pid: 42,
      token: 'replacement-owner-token',
    };
    const storage = createRemediationCaseStateStorage({
      createEmptyState: () => ({ version: 1 }),
      isValidState: (state) => state?.version === 1,
      path,
    });

    storage.withLock(Date.parse(replacement.createdAt), null, () => {
      unlinkSync(lockPath);
      writeFileSync(lockPath, JSON.stringify(replacement));
    });

    assert.deepEqual(JSON.parse(readFileSync(lockPath, 'utf8')), replacement);
  });

  it('preserves an action error even when it has an EEXIST code', () => {
    const path = join(
      mkdtempSync(join(tmpdir(), 'baci-case-storage-action-error-')),
      'state.json'
    );
    const storage = createRemediationCaseStateStorage({
      createEmptyState: () => ({ version: 1 }),
      isValidState: (state) => state?.version === 1,
      path,
    });
    const failure = Object.assign(new Error('action failed'), {
      code: 'EEXIST',
    });

    assert.throws(
      () =>
        storage.withLock(Date.now(), null, () => {
          throw failure;
        }),
      (error) => error === failure
    );
  });

  it('reclaims a stale case-state lock after its PID has been reused', () => {
    const path = join(
      mkdtempSync(join(tmpdir(), 'baci-case-storage-pid-reuse-')),
      'state.json'
    );
    const token = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    writeFileSync(
      `${path}.lock`,
      JSON.stringify({
        createdAt: '2026-08-09T10:00:00.000Z',
        pid: 42,
        processStartedAt: 'original-process',
        token,
      })
    );
    const storage = createRemediationCaseStateStorage({
      createEmptyState: () => ({ version: 1 }),
      isValidState: (state) => state?.version === 1,
      path,
      processIsAlive: () => true,
      processStartedAt: () => 'reused-process',
    });

    assert.deepEqual(
      storage.withLock(
        Date.parse('2026-08-09T10:05:00.000Z'),
        null,
        (state) => state
      ),
      { version: 1 }
    );
  });
});
