import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyEventPipelineBoundaries } from './verify-event-pipeline-boundaries';

const roots: string[] = [];

function git(root: string, ...args: string[]) {
  execFileSync('git', args, { cwd: root });
}

function repository(): string {
  const root = mkdtempSync(join(tmpdir(), 'event-verifier-stage-'));
  roots.push(root);
  git(root, 'init', '--quiet');
  git(root, 'config', 'user.email', 'tests@example.com');
  git(root, 'config', 'user.name', 'Tests');
  const files = new Map([
    [
      'apps/web/tools/events/fixtures/event-pipeline-path-inventory.tsv',
      'seed\tapps/web/src/lib/events/rogue-factory.ts\n',
    ],
    ['apps/web/src/lib/events/rogue-factory.ts', 'export const safe = true;\n'],
    [
      'apps/web/src/lib/supabase/service.ts',
      'export const createServiceClient = () => null;\n',
    ],
  ]);
  for (const [path, source] of files) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), source);
  }
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'baseline');
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { force: true, recursive: true });
});

describe('event pipeline verifier staged source snapshot', () => {
  it('rejects staged authority hidden by a clean unstaged worktree copy', () => {
    const root = repository();
    const path = 'apps/web/src/lib/events/rogue-factory.ts';
    writeFileSync(
      join(root, path),
      "import { createServiceClient } from '@/lib/supabase/service';\n"
    );
    git(root, 'add', path);
    writeFileSync(join(root, path), 'export const safe = true;\n');

    expect(verifyEventPipelineBoundaries(root)).toContain(
      `${path}: unauthorized service factory importer`
    );
  });
});
