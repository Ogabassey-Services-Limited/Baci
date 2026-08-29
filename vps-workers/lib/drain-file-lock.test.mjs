import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { withDrainFileLock } from './drain-file-lock.mjs';

describe('drain file lock', () => {
  it('releases the lock after the critical section succeeds', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-drain-lock-'));
    const lockPath = join(directory, 'vercel-drain.jsonl.lock');

    assert.equal(
      withDrainFileLock(lockPath, () => 'done'),
      'done'
    );
    assert.throws(() => statSync(lockPath), { code: 'ENOENT' });
  });

  it('reclaims an abandoned lock before running the critical section', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-drain-lock-'));
    const lockPath = join(directory, 'vercel-drain.jsonl.lock');
    mkdirSync(directory, { recursive: true });
    writeFileSync(lockPath, '999999\n');
    const oldTime = Date.now() - 120_000;
    utimesSync(lockPath, oldTime / 1_000, oldTime / 1_000);

    assert.equal(
      withDrainFileLock(lockPath, () => 'recovered'),
      'recovered'
    );
    assert.throws(() => statSync(lockPath), { code: 'ENOENT' });
  });

  it('reclaims a fresh lock immediately when its recorded owner is gone', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-drain-lock-'));
    const lockPath = join(directory, 'vercel-drain.jsonl.lock');
    writeFileSync(lockPath, '99999999\n');

    assert.equal(
      withDrainFileLock(lockPath, () => 'recovered'),
      'recovered'
    );
    assert.throws(() => statSync(lockPath), { code: 'ENOENT' });
  });
});
