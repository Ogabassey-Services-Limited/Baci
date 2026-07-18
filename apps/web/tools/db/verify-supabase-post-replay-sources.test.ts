import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifySupabasePostReplaySources } from './verify-supabase-post-replay-sources';

const temporaryRoots: string[] = [];
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-post-replay-'));
  temporaryRoots.push(root);
  await mkdir(path.join(root, 'supabase/migrations'), { recursive: true });
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('verifySupabasePostReplaySources', () => {
  it('binds a safe top-level SQL source to its exact bytes', async () => {
    const root = await createWorkspace();
    const body = 'select 1;\n';
    const repositoryPath =
      'supabase/migrations/20260718070000_credit_direct_review.sql';
    await writeFile(path.join(root, repositoryPath), body);

    await expect(
      verifySupabasePostReplaySources(
        root,
        [{ repositoryPath, sha256: sha256(body) }],
        '20260714225503'
      )
    ).resolves.toEqual([
      {
        receiptId: `post-replay:${repositoryPath}`,
        repositoryPath,
        sha256: sha256(body),
      },
    ]);
  });

  it('rejects sources at or before the frozen replay tail', async () => {
    const root = await createWorkspace();
    const body = 'select 1;\n';
    const repositoryPath =
      'supabase/migrations/20260714225503_not_after_tail.sql';
    await writeFile(path.join(root, repositoryPath), body);

    await expect(
      verifySupabasePostReplaySources(
        root,
        [{ repositoryPath, sha256: sha256(body) }],
        '20260714225503'
      )
    ).rejects.toThrow(/after.*tail/i);
  });

  it('rejects duplicate migration versions', async () => {
    const root = await createWorkspace();
    const body = 'select 1;\n';
    const first = 'supabase/migrations/20260718070000_first.sql';
    const second = 'supabase/migrations/20260718070000_second.sql';
    await writeFile(path.join(root, first), body);
    await writeFile(path.join(root, second), body);

    await expect(
      verifySupabasePostReplaySources(
        root,
        [first, second].map((repositoryPath) => ({
          repositoryPath,
          sha256: sha256(body),
        })),
        '20260714225503'
      )
    ).rejects.toThrow(/duplicate.*version/i);
  });

  it('rejects nested, non-SQL, symlink, and hash-drifted sources', async () => {
    const root = await createWorkspace();
    const body = 'select 1;\n';
    const valid = 'supabase/migrations/20260718070000_valid.sql';
    await writeFile(path.join(root, valid), body);
    await symlink(
      path.basename(valid),
      path.join(root, 'supabase/migrations/20260718070001_link.sql')
    );

    const invalidCases = [
      {
        repositoryPath: 'supabase/migrations/nested/20260718070002_nested.sql',
        sha256: sha256(body),
      },
      {
        repositoryPath: 'supabase/migrations/20260718070002_not_sql.txt',
        sha256: sha256(body),
      },
      {
        repositoryPath: 'supabase/migrations/20260718070001_link.sql',
        sha256: sha256(body),
      },
      { repositoryPath: valid, sha256: '0'.repeat(64) },
    ];

    for (const source of invalidCases) {
      await expect(
        verifySupabasePostReplaySources(root, [source], '20260714225503')
      ).rejects.toThrow();
    }
  });
});
