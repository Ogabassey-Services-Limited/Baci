import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyAnalyticsDeliveryAuthority } from './verify-analytics-delivery-authority';

const roots: string[] = [];
const cutoverPath =
  'apps/web/src/lib/events/event-pipeline-authority-cutover.ts';

function git(root: string, ...args: string[]) {
  execFileSync('git', args, { cwd: root });
}

function repository(): string {
  const root = mkdtempSync(join(tmpdir(), 'analytics-cutover-stage-'));
  roots.push(root);
  git(root, 'init', '--quiet');
  git(root, 'config', 'user.email', 'tests@example.com');
  git(root, 'config', 'user.name', 'Tests');
  mkdirSync(join(root, cutoverPath, '..'), { recursive: true });
  writeFileSync(
    join(root, cutoverPath),
    'export const eventPipelineAuthorityCutover = { queueOnlyDeliveryActivated: false } as const;\n'
  );
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'baseline');
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { force: true, recursive: true });
});

describe('analytics authority staged cutover', () => {
  it('revokes authority from staged true even when worktree masks it as false', () => {
    const root = repository();
    writeFileSync(
      join(root, cutoverPath),
      'export const eventPipelineAuthorityCutover = { queueOnlyDeliveryActivated: true } as const;\n'
    );
    git(root, 'add', cutoverPath);
    writeFileSync(
      join(root, cutoverPath),
      'export const eventPipelineAuthorityCutover = { queueOnlyDeliveryActivated: false } as const;\n'
    );

    expect(verifyAnalyticsDeliveryAuthority(root)).toContain(
      'temporary event-pipeline analytics authority expired because queue-only delivery is active'
    );
  });
});
