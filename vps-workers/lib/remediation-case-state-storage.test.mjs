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
    writeFileSync(lockPath, 'stale');
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
    const failure = Object.assign(new Error('action failed'), { code: 'EEXIST' });

    assert.throws(
      () => storage.withLock(Date.now(), null, () => { throw failure; }),
      (error) => error === failure
    );
  });
});
