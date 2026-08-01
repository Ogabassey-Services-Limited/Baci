import { chmod, lstat, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const pathnameReplacementAttack = vi.hoisted(() => ({
  armed: false,
  maliciousPath: undefined as string | undefined,
  safePath: undefined as string | undefined,
  target: undefined as string | undefined,
  triggered: false,
}));

vi.mock('node:fs/promises', async () => {
  const actual =
    await vi.importActual<typeof import('node:fs/promises')>(
      'node:fs/promises'
    );
  return {
    ...actual,
    lstat: async (path: Parameters<typeof actual.lstat>[0]) => {
      const stat = await actual.lstat(path);
      if (
        pathnameReplacementAttack.armed &&
        typeof path === 'string' &&
        path === pathnameReplacementAttack.target
      ) {
        pathnameReplacementAttack.armed = false;
        pathnameReplacementAttack.triggered = true;
        await actual.rename(path, pathnameReplacementAttack.safePath as string);
        await actual.symlink(
          pathnameReplacementAttack.maliciousPath as string,
          path
        );
      }
      return stat;
    },
  };
});

import {
  loadEvidenceRunForCleanup,
  openEvidenceRun,
} from './cloudflare-evidence-run-journal';

const runId = '0123456789abcdef0123456789abcdef';
const input = {
  runId,
  approvalId: 'approval',
  policyId: 'policy',
  toolingMergeSha: '1'.repeat(40),
  writeTokenId: 'write',
  readTokenId: 'read',
  readPolicySha256: 'c'.repeat(64),
  accountId: 'account',
  zoneId: 'zone',
  plannedResources: ['evidence-run-123-worker'],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
};

describe('CloudflareEvidenceRunJournal pathname safety', () => {
  it('reads the opened journal handle after pathname replacement with a symlink', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    const opened = await openEvidenceRun(dir, input);
    const target = join(dir, `${runId}.json`);
    const safePath = join(dir, 'journal-safe.json');
    const maliciousPath = join(dir, 'journal-attacker.json');
    await writeFile(
      maliciousPath,
      JSON.stringify({ ...opened, phase: 'closed_stop' }),
      { mode: 0o600 }
    );
    pathnameReplacementAttack.target = target;
    pathnameReplacementAttack.safePath = safePath;
    pathnameReplacementAttack.maliciousPath = maliciousPath;
    pathnameReplacementAttack.triggered = false;
    pathnameReplacementAttack.armed = true;

    const journal = await loadEvidenceRunForCleanup(dir, runId);

    pathnameReplacementAttack.armed = false;
    expect(journal.phase).toBe('prepared');
    expect(pathnameReplacementAttack.triggered).toBe(false);
    expect((await lstat(target)).isSymbolicLink()).toBe(false);
    expect(await readFile(target, 'utf8')).toContain('"phase":"prepared"');
  });
});
