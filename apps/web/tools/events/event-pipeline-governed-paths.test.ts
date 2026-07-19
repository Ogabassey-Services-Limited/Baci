import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { eventPipelineGovernedPaths } from './event-pipeline-governed-paths';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { force: true, recursive: true });
});

describe('eventPipelineGovernedPaths', () => {
  it('loads the frozen seed inventory and current source inventory safely', () => {
    const governed = eventPipelineGovernedPaths.collect();
    expect(governed.fixtureRecordCount).toBe(154);
    expect(governed.productionPaths).toContain(
      'apps/web/src/scripts/process-event-deliveries.ts'
    );
    expect(governed.seedPaths).toContain('apps/web/src/app/checkout/page.tsx');
    expect(governed.missingProductionRoots).toEqual([]);
  });

  it('discovers every supported JavaScript and TypeScript source extension', () => {
    const root = mkdtempSync(join(tmpdir(), 'event-source-paths-'));
    directories.push(root);
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    const paths = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts'].map(
      (extension) => `authority.${extension}`
    );
    for (const path of paths) writeFileSync(join(root, path), 'export {};');

    expect(eventPipelineGovernedPaths.sourcePaths(root).sort()).toEqual(
      paths.sort()
    );
  });

  it('preserves newline-bearing source paths from every Git inventory', () => {
    const root = mkdtempSync(join(tmpdir(), 'event-governed-paths-'));
    directories.push(root);
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'tests@example.com'], {
      cwd: root,
    });
    execFileSync('git', ['config', 'user.name', 'Tests'], { cwd: root });
    const fixtureDirectory = join(root, 'apps/web/tools/events/fixtures');
    mkdirSync(fixtureDirectory, { recursive: true });
    writeFileSync(
      join(fixtureDirectory, 'event-pipeline-path-inventory.tsv'),
      'seed\tapps/web/src/root.ts\n'
    );
    writeFileSync(join(root, 'baseline.ts'), 'export {};');
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '--quiet', '-m', 'baseline'], { cwd: root });
    execFileSync('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD'], {
      cwd: root,
    });
    const path = 'apps/web/src/line\nbreak.ts';
    mkdirSync(join(root, 'apps/web/src'), { recursive: true });
    writeFileSync(join(root, path), 'export {};');

    expect(eventPipelineGovernedPaths.sourcePaths(root)).toContain(path);
    expect(eventPipelineGovernedPaths.collect(root).paths).toContain(path);
  });
});
