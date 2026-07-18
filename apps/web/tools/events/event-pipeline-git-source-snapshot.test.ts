import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readGitSourceSnapshot } from './event-pipeline-git-source-snapshot';

const roots: string[] = [];

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function repository(): string {
  const root = mkdtempSync(join(tmpdir(), 'event-source-snapshot-'));
  roots.push(root);
  git(root, 'init', '--quiet');
  git(root, 'config', 'user.email', 'tests@example.com');
  git(root, 'config', 'user.name', 'Tests');
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { force: true, recursive: true });
});

describe('readGitSourceSnapshot', () => {
  it('reads a committed revision independently of index and worktree overlays', () => {
    const root = repository();
    writeFileSync(join(root, 'authority.ts'), 'export const edge = "base";\n');
    git(root, 'add', 'authority.ts');
    git(root, 'commit', '--quiet', '-m', 'baseline');
    const baseSha = git(root, 'rev-parse', 'HEAD').trim();
    writeFileSync(
      join(root, 'authority.ts'),
      'export const edge = "staged";\n'
    );
    git(root, 'add', 'authority.ts');
    writeFileSync(
      join(root, 'authority.ts'),
      'export const edge = "worktree";\n'
    );

    expect(
      readGitSourceSnapshot.committedRevision(root, baseSha).get('authority.ts')
    ).toBe('export const edge = "base";\n');
  });

  it('fails closed when the committed revision is unavailable', () => {
    const root = repository();
    expect(() =>
      readGitSourceSnapshot.committedRevision(root, 'missing-frozen-sha')
    ).toThrow();
  });

  it('reads staged bytes when a clean worktree copy masks them', () => {
    const root = repository();
    mkdirSync(join(root, 'src'));
    const path = join(root, 'src', 'authority.ts');
    writeFileSync(path, 'export const authority = "baseline";\n');
    git(root, 'add', 'src/authority.ts');
    git(root, 'commit', '--quiet', '-m', 'baseline');

    writeFileSync(path, 'export const authority = "malicious staged";\n');
    git(root, 'add', 'src/authority.ts');
    writeFileSync(path, 'export const authority = "clean worktree";\n');

    expect(readGitSourceSnapshot(root).sources.get('src/authority.ts')).toBe(
      'export const authority = "malicious staged";\n'
    );
  });

  it('uses staged additions and excludes staged deletions restored in the worktree', () => {
    const root = repository();
    writeFileSync(join(root, 'deleted.mjs'), 'export const deleted = true;\n');
    git(root, 'add', 'deleted.mjs');
    git(root, 'commit', '--quiet', '-m', 'baseline');

    rmSync(join(root, 'deleted.mjs'));
    git(root, 'add', 'deleted.mjs');
    writeFileSync(join(root, 'deleted.mjs'), 'export const restored = true;\n');
    writeFileSync(join(root, 'added.cjs'), 'module.exports = "staged";\n');
    git(root, 'add', 'added.cjs');
    writeFileSync(join(root, 'added.cjs'), 'module.exports = "masked";\n');

    const snapshot = readGitSourceSnapshot(root).sources;
    expect(snapshot.has('deleted.mjs')).toBe(false);
    expect(snapshot.get('added.cjs')).toBe('module.exports = "staged";\n');
  });

  it('reads untracked source files from the worktree', () => {
    const root = repository();
    writeFileSync(
      join(root, 'untracked.jsx'),
      'export const View = () => null;\n'
    );

    expect(readGitSourceSnapshot(root).sources.get('untracked.jsx')).toBe(
      'export const View = () => null;\n'
    );
  });

  it('distinguishes an unmerged staged path without a stage-zero blob', () => {
    const root = repository();
    writeFileSync(join(root, 'authority.ts'), 'export const side = "base";\n');
    git(root, 'add', 'authority.ts');
    git(root, 'commit', '--quiet', '-m', 'baseline');
    const defaultBranch = git(root, 'rev-parse', '--abbrev-ref', 'HEAD').trim();
    git(root, 'checkout', '--quiet', '-b', 'incoming');
    writeFileSync(
      join(root, 'authority.ts'),
      'export const side = "incoming";\n'
    );
    git(root, 'commit', '--quiet', '-am', 'incoming');
    git(root, 'checkout', '--quiet', defaultBranch);
    writeFileSync(
      join(root, 'authority.ts'),
      'export const side = "current";\n'
    );
    git(root, 'commit', '--quiet', '-am', 'current');
    expect(() => git(root, 'merge', '--no-edit', 'incoming')).toThrow();

    const snapshot = readGitSourceSnapshot(root);
    expect(snapshot.missingPaths).toContain('authority.ts');
    expect(snapshot.missingStagedPaths).toEqual(['authority.ts']);
  });
});
