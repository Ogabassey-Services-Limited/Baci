import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import { removeLegacyRemediationLockArtifacts } from './remediation-case-state-legacy-lock-cleanup.mjs';

it('removes only exact legacy remediation lock artifacts', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'baci-legacy-lock-cleanup-'));
  t.after(() => rmSync(directory, { force: true, recursive: true }));
  const lockPath = join(directory, 'state.json.lock');
  const token = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const legacyPaths = [
    lockPath,
    `${lockPath}.owner-${token}`,
    `${lockPath}.reclaim-${token}`,
    `${lockPath}.reclaim-ownerless`,
  ];
  const unrelatedPath = `${lockPath}.owner-not-a-token`;
  for (const path of [...legacyPaths, unrelatedPath]) writeFileSync(path, 'x');

  removeLegacyRemediationLockArtifacts(lockPath, unlinkSync);

  assert.equal(legacyPaths.some(existsSync), false);
  assert.equal(existsSync(unrelatedPath), true);
});
