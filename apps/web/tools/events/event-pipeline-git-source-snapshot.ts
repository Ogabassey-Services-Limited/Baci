import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readGitIndexSources } from './event-pipeline-git-content';
import { eventPipelineSourceFilePolicy } from './event-pipeline-source-file-policy';

function gitPaths(root: string, args: readonly string[]): string[] {
  return execFileSync(
    'git',
    [...args, '--', ...eventPipelineSourceFilePolicy.pathspecs],
    {
      cwd: root,
      encoding: 'utf8',
    }
  )
    .split('\0')
    .filter(Boolean);
}

export function readGitSourceSnapshot(root: string): {
  missingPaths: string[];
  missingStagedPaths: string[];
  sources: Map<string, string>;
} {
  const tracked = gitPaths(root, ['ls-files', '--cached', '-z']);
  const untracked = gitPaths(root, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
  ]);
  const staged = new Set(
    gitPaths(root, [
      'diff',
      '--cached',
      '--no-renames',
      '--name-only',
      '--diff-filter=ACMRTUXB',
      '-z',
    ])
  );
  const deleted = new Set(
    gitPaths(root, [
      'diff',
      '--cached',
      '--no-renames',
      '--name-only',
      '--diff-filter=D',
      '-z',
    ])
  );
  const paths = [...new Set([...tracked, ...untracked])]
    .filter((path) => !deleted.has(path))
    .sort();
  const missingPaths: string[] = [];
  const missingStagedPaths: string[] = [];
  const sources = new Map<string, string>();
  const stagedSources = readGitIndexSources(root, [...staged]);

  for (const path of paths) {
    if (staged.has(path)) {
      const source = stagedSources.get(path);
      if (source === undefined) {
        missingPaths.push(path);
        missingStagedPaths.push(path);
        continue;
      }
      sources.set(path, source);
      continue;
    }
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) {
      missingPaths.push(path);
      continue;
    }
    sources.set(path, readFileSync(absolute, 'utf8'));
  }

  return { missingPaths, missingStagedPaths, sources };
}
