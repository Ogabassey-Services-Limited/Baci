#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const ZERO_BLOB = '0000000000000000000000000000000000000000';

export function parseRawDiff(rawDiff) {
  const entries = [];

  for (const line of rawDiff.split('\n')) {
    if (!line.startsWith(':')) {
      continue;
    }

    const [metadata, ...paths] = line.split('\t');
    const parts = metadata.split(/\s+/);
    if (parts.length < 5 || paths.length === 0) {
      continue;
    }

    const oldBlob = parts[2];
    const newBlob = parts[3];
    const status = parts[4];

    if (status.startsWith('R') && paths.length >= 2) {
      entries.push({
        kind: 'D',
        newBlob: ZERO_BLOB,
        oldBlob,
        path: paths[0],
      });
      entries.push({
        kind: 'A',
        newBlob,
        oldBlob: ZERO_BLOB,
        path: paths[1],
      });
      continue;
    }

    if (status.startsWith('C')) {
      entries.push({
        kind: 'A',
        newBlob,
        oldBlob: ZERO_BLOB,
        path: paths.at(-1),
      });
      continue;
    }

    entries.push({
      kind: status[0],
      newBlob,
      oldBlob,
      path: paths.at(-1),
    });
  }

  return entries;
}

export function findSilentReverts({ pullRequestEntries, recentCommits }) {
  const entriesByPath = new Map();

  for (const entry of pullRequestEntries) {
    const existingEntries = entriesByPath.get(entry.path) ?? [];
    existingEntries.push(entry);
    entriesByPath.set(entry.path, existingEntries);
  }

  const findings = [];
  const seen = new Set();

  for (const recentCommit of recentCommits) {
    for (const recentEntry of recentCommit.entries) {
      const pullRequestPathEntries = entriesByPath.get(recentEntry.path);
      if (!pullRequestPathEntries) {
        continue;
      }

      for (const pullRequestEntry of pullRequestPathEntries) {
        const key = [
          recentCommit.sha,
          recentEntry.path,
          recentEntry.oldBlob,
          recentEntry.newBlob,
          pullRequestEntry.oldBlob,
          pullRequestEntry.newBlob,
        ].join(':');
        if (seen.has(key)) {
          continue;
        }

        const findingKind = classifySilentRevert({
          pullRequestEntry,
          recentEntry,
        });
        if (!findingKind) {
          continue;
        }

        findings.push({
          commit: recentCommit.sha,
          commitSubject: recentCommit.subject,
          kind: findingKind,
          path: recentEntry.path,
        });
        seen.add(key);
      }
    }
  }

  return findings;
}

function classifySilentRevert({ pullRequestEntry, recentEntry }) {
  // Direct restoration: base has the newer blob from a recent commit, while the
  // pull request changes it back to the older blob from before that commit.
  if (
    recentEntry.oldBlob !== ZERO_BLOB &&
    recentEntry.newBlob !== ZERO_BLOB &&
    pullRequestEntry.oldBlob === recentEntry.newBlob &&
    pullRequestEntry.newBlob === recentEntry.oldBlob
  ) {
    return 'restores previous blob';
  }

  // Recent commit added a file; pull request deletes that exact file blob.
  if (
    recentEntry.oldBlob === ZERO_BLOB &&
    recentEntry.newBlob !== ZERO_BLOB &&
    pullRequestEntry.oldBlob === recentEntry.newBlob &&
    pullRequestEntry.newBlob === ZERO_BLOB
  ) {
    return 'deletes recently added file';
  }

  // Recent commit deleted a file; pull request reintroduces the exact old blob.
  if (
    recentEntry.oldBlob !== ZERO_BLOB &&
    recentEntry.newBlob === ZERO_BLOB &&
    pullRequestEntry.oldBlob === ZERO_BLOB &&
    pullRequestEntry.newBlob === recentEntry.oldBlob
  ) {
    return 'restores recently deleted file';
  }

  return null;
}

function git(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed with exit ${result.status}: ${result.stderr}`
    );
  }

  return result.stdout;
}

function gitMaybe(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout;
}

function escapeAnnotationValue(value) {
  return value
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A')
    .replaceAll(':', '%3A')
    .replaceAll(',', '%2C');
}

function parsePositiveInteger(value, fallback) {
  const parsedValue = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

function buildRecentCommits({ baseSha, lookbackCommitCount }) {
  const commits = git([
    'rev-list',
    '--first-parent',
    `--max-count=${lookbackCommitCount}`,
    baseSha,
  ])
    .split('\n')
    .filter(Boolean);

  return commits.flatMap((sha) => {
    const parent = gitMaybe(['rev-parse', `${sha}^`])?.trim();
    if (!parent) {
      return [];
    }

    const subject = git(['show', '-s', '--format=%s', sha]).trim();
    const entries = parseRawDiff(
      git(['diff-tree', '--raw', '--no-abbrev', '-r', '-M', parent, sha])
    );

    return [{ entries, sha, subject }];
  });
}

function main() {
  const baseSha = process.env.BASE_SHA;
  const headSha = process.env.HEAD_SHA ?? 'HEAD';
  const allowSilentRevert = process.env.ALLOW_SILENT_REVERT === 'true';
  const lookbackCommitCount = parsePositiveInteger(
    process.env.SILENT_REVERT_LOOKBACK,
    80
  );

  if (!baseSha) {
    console.log('BASE_SHA is not set; skipping silent revert guard.');
    return;
  }

  const pullRequestEntries = parseRawDiff(
    git(['diff', '--raw', '--no-abbrev', '-r', '-M', baseSha, headSha])
  );

  if (pullRequestEntries.length === 0) {
    console.log('Silent Revert Guard: no pull request file changes detected.');
    return;
  }

  const recentCommits = buildRecentCommits({ baseSha, lookbackCommitCount });
  const findings = findSilentReverts({ pullRequestEntries, recentCommits });

  if (findings.length === 0) {
    console.log(
      `Silent Revert Guard: no direct reverts found across ${recentCommits.length} recent first-parent commits.`
    );
    return;
  }

  const annotationCommand = allowSilentRevert ? 'warning' : 'error';
  console.log(
    `Silent Revert Guard: found ${findings.length} direct recent-commit revert(s).`
  );

  for (const finding of findings) {
    const message = `${finding.kind}; reverts ${finding.commit.slice(0, 12)} ${finding.commitSubject}`;
    console.log(
      `::${annotationCommand} file=${escapeAnnotationValue(finding.path)}::${escapeAnnotationValue(message)}`
    );
    console.log(`- ${finding.path}: ${message}`);
  }

  if (allowSilentRevert) {
    console.log(
      'ALLOW_SILENT_REVERT=true; treating findings as intentional after explicit PR labeling.'
    );
    return;
  }

  console.error(
    'Silent Revert Guard failed. If this is an intentional restore/revert, add the allow-silent-revert label and explain the restore in the PR body.'
  );
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
