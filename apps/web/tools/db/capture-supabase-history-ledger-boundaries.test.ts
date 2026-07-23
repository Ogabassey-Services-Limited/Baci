import { createHash } from 'node:crypto';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureSupabaseHistoryLedger } from './capture-supabase-history-ledger';

const roots: string[] = [];
const effectQuery = 'SELECT 1;\n';
const effectQuerySha256 = createHash('sha256')
  .update(effectQuery)
  .digest('hex');
const migrationList = `
Local | Remote | Time (UTC)
------|--------|----------
      | 20260701000000 | 2026-07-01 00:00:00
`;

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-ledger-boundary-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('captureSupabaseHistoryLedger boundaries', () => {
  it('uses the official read-only Management API endpoint', async () => {
    const root = await temporaryRoot();
    const fetchMock = vi.fn(async () => new Response('[]'));
    vi.stubEnv('SUPABASE_ACCESS_TOKEN', 'secret');
    vi.stubEnv('SUPABASE_PROJECT_REF', 'abcdefghijklmnopqrst');
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      captureSupabaseHistoryLedger(
        {
          effectsFixtureOutput: 'effects.json',
          linkedFixtureOutput: 'ledger.json',
          workspaceRoot: root,
        },
        {
          expectedEffectQuerySha256: effectQuerySha256,
          readTextFile: async () => effectQuery,
          runCommand: async () => ({ stderr: '', stdout: migrationList }),
        }
      )
    ).rejects.toThrow(/linked migration inventory/i);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/database/query/read-only',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('rejects identical canonical outputs before dependency calls', async () => {
    const root = await temporaryRoot();
    await symlink(root, path.join(root, 'alias'));
    for (const [linkedFixtureOutput, effectsFixtureOutput] of [
      ['same.json', 'same.json'],
      ['same.json', 'alias/same.json'],
    ]) {
      const dependencies = {
        executeSelect: vi.fn(),
        readEffects: vi.fn(),
        readGitObject: vi.fn(),
        readTextFile: vi.fn(),
        runCommand: vi.fn(),
      };
      await expect(
        captureSupabaseHistoryLedger(
          { effectsFixtureOutput, linkedFixtureOutput, workspaceRoot: root },
          dependencies
        )
      ).rejects.toThrow(/^Captured replay fixture outputs must be distinct$/);
      for (const dependency of Object.values(dependencies)) {
        expect(dependency).not.toHaveBeenCalled();
      }
    }
  });

  it('rejects mutually exclusive capture modes before dependency calls', async () => {
    const dependencies = {
      executeSelect: vi.fn(),
      readEffects: vi.fn(),
      readGitObject: vi.fn(),
      readTextFile: vi.fn(),
      runCommand: vi.fn(),
    };
    await expect(
      captureSupabaseHistoryLedger(
        {
          refreshEffectsFixture: true,
          verifyOnly: true,
          workspaceRoot: '/not-read',
        },
        dependencies
      )
    ).rejects.toThrow('Capture fixture mode is invalid');
    for (const dependency of Object.values(dependencies)) {
      expect(dependency).not.toHaveBeenCalled();
    }
  });
});
