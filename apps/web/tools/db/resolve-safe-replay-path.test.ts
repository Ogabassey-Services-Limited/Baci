import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveSafeReplayPath } from './resolve-safe-replay-path';

const temporaryRoots: string[] = [];

async function workspaceRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-safe-replay-path-'));
  temporaryRoots.push(root);
  await mkdir(path.join(root, 'supabase/migrations'), { recursive: true });
  return realpath(root);
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('resolveSafeReplayPath', () => {
  it('resolves a valid existing repository source', async () => {
    const root = await workspaceRoot();
    const repositoryPath = 'supabase/migrations/20260714225501_repair.sql';
    const target = path.join(root, repositoryPath);
    await writeFile(target, 'select 1;\n');

    await expect(resolveSafeReplayPath(root, repositoryPath)).resolves.toBe(
      target
    );
  });

  it('canonicalizes a symlinked workspace root before containment checks', async () => {
    const root = await workspaceRoot();
    const linkHolder = await mkdtemp(
      path.join(tmpdir(), 'baci-safe-replay-path-link-')
    );
    temporaryRoots.push(linkHolder);
    const linkedRoot = path.join(linkHolder, 'workspace');
    await symlink(root, linkedRoot, 'dir');
    const repositoryPath = 'supabase/migrations/canonical-root.sql';
    const target = path.join(root, repositoryPath);
    await writeFile(target, 'select 1;\n');

    await expect(
      resolveSafeReplayPath(linkedRoot, repositoryPath)
    ).resolves.toBe(target);
  });

  it('resolves a valid non-existing target when its parent is inside the workspace', async () => {
    const root = await workspaceRoot();
    const repositoryPath = 'supabase/migrations/20260714225502_repair.sql';

    await expect(
      resolveSafeReplayPath(root, repositoryPath, false)
    ).resolves.toBe(path.join(root, repositoryPath));
  });

  it.each([
    '/tmp/absolute.sql',
    'supabase\\migrations\\backslash.sql',
    'supabase/migrations/../dotdot.sql',
    '../workspace-escape.sql',
  ])('rejects an unsafe repository path: %s', async (repositoryPath) => {
    const root = await workspaceRoot();

    await expect(
      resolveSafeReplayPath(root, repositoryPath, false)
    ).rejects.toThrow(`Unsafe repository path: ${repositoryPath}`);
  });

  it('rejects a non-existing target whose parent symlink escapes the workspace', async () => {
    const root = await workspaceRoot();
    const outside = await mkdtemp(
      path.join(tmpdir(), 'baci-safe-replay-path-outside-')
    );
    temporaryRoots.push(outside);
    await symlink(outside, path.join(root, 'escaped'));

    await expect(
      resolveSafeReplayPath(root, 'escaped/future.sql', false)
    ).rejects.toThrow(
      'Repository path resolves outside workspace: escaped/future.sql'
    );
  });

  it('rejects an existing repository source symlink', async () => {
    const root = await workspaceRoot();
    const source = path.join(root, 'supabase/migrations/source.sql');
    const linked = path.join(root, 'supabase/migrations/linked.sql');
    await writeFile(source, 'select 1;\n');
    await symlink(source, linked);

    await expect(
      resolveSafeReplayPath(root, 'supabase/migrations/linked.sql')
    ).rejects.toThrow(
      'Repository source may not be a symlink: supabase/migrations/linked.sql'
    );
  });
});
