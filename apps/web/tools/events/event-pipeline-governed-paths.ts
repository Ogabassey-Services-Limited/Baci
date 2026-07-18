import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { eventPipelineBoundaryManifest } from '../../src/lib/events/event-pipeline-boundary-manifest';
import { collectProductionImportClosure } from '../../src/lib/events/event-pipeline-import-closure';
import { readSourceInventory } from './event-pipeline-source-inventory';

function repoRoot(): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
}

function gitLines(root: string, args: readonly string[]): string[] {
  return execFileSync('git', [...args], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

function sourcePaths(root: string): string[] {
  return gitLines(root, [
    'ls-files',
    '-co',
    '--exclude-standard',
    '*.ts',
    '*.tsx',
    '*.mjs',
  ]);
}

function collect() {
  const root = repoRoot();
  const fixturePath = resolve(
    root,
    'apps/web/tools/events/fixtures/event-pipeline-path-inventory.tsv'
  );
  const fixtureRecords = readFileSync(fixturePath, 'utf8')
    .trimEnd()
    .split('\n');
  const fixturePaths = fixtureRecords.map((line) => line.split('\t')[1] ?? '');
  const inventory = readSourceInventory(root, sourcePaths(root));
  const productionClosure = collectProductionImportClosure(
    eventPipelineBoundaryManifest.productionRoots,
    inventory.sources
  );
  const dynamicPaths = [
    ...gitLines(root, ['diff', '--name-only', 'origin/main...HEAD']),
    ...gitLines(root, ['diff', '--cached', '--name-only']),
    ...gitLines(root, ['diff', '--name-only']),
    ...gitLines(root, ['ls-files', '--others', '--exclude-standard']),
  ];
  const governedSourcePath = (path: string) => /\.(?:mjs|tsx?)$/.test(path);
  return {
    changedPaths: dynamicPaths,
    fixtureRecordCount: fixtureRecords.length,
    missingProductionRoots:
      eventPipelineBoundaryManifest.productionRoots.filter(
        (path) => !inventory.sources.has(path)
      ),
    paths: [...new Set([...productionClosure, ...dynamicPaths])]
      .filter(governedSourcePath)
      .filter((path) => !path.endsWith('/supabase/.temp/cli-latest'))
      .sort(),
    seedPaths: fixturePaths.filter(governedSourcePath),
  };
}

export const eventPipelineGovernedPaths = {
  collect,
  repoRoot,
  sourcePaths,
} as const;
