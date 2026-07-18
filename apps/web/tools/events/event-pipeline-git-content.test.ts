import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readGitIndexSources } from './event-pipeline-git-content';

const repositories: string[] = [];

afterEach(() => {
  for (const repository of repositories.splice(0)) {
    rmSync(repository, { force: true, recursive: true });
  }
});

describe('readGitIndexSources', () => {
  it('reads stage-zero bytes when a clean worktree masks staged content', () => {
    const repository = mkdtempSync(join(tmpdir(), 'event-git-content-'));
    repositories.push(repository);
    const path = ':(glob) staged [edge].ts';
    const absolutePath = join(repository, path);
    mkdirSync(dirname(absolutePath), { recursive: true });

    execFileSync('git', ['init', '--quiet'], { cwd: repository });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], {
      cwd: repository,
    });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repository });
    writeFileSync(absolutePath, 'export const authority = "safe";\n');
    execFileSync('git', ['--literal-pathspecs', 'add', '--', path], {
      cwd: repository,
    });
    execFileSync('git', ['commit', '--quiet', '-m', 'initial'], {
      cwd: repository,
    });

    const stagedSource = 'export const authority = "staged-malicious";\n';
    writeFileSync(absolutePath, stagedSource);
    execFileSync('git', ['--literal-pathspecs', 'add', '--', path], {
      cwd: repository,
    });
    writeFileSync(absolutePath, 'export const authority = "safe";\n');

    expect(readGitIndexSources(repository, [path]).get(path)).toBe(
      stagedSource
    );
  });
});
