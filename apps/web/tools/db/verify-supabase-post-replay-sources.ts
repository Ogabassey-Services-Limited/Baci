import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { resolveSafeReplayPath } from './resolve-safe-replay-path';
import type {
  FrozenReplaySource,
  ReplaySource,
} from './supabase-history-replay-types';

const POST_REPLAY_MIGRATION =
  /^supabase\/migrations\/(\d{14})_[a-z0-9_]+[.]sql$/;
const SHA_256 = /^[a-f0-9]{64}$/;

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function verifySupabasePostReplaySources(
  workspaceRoot: string,
  sources: readonly FrozenReplaySource[],
  frozenReplayTailVersion: string
): Promise<ReplaySource[]> {
  if (!/^\d{14}$/.test(frozenReplayTailVersion)) {
    throw new Error('Invalid frozen replay tail version');
  }

  const root = await realpath(path.resolve(workspaceRoot));
  const paths = new Set<string>();
  const versions = new Set<string>();
  const verified: ReplaySource[] = [];
  let previousVersion = frozenReplayTailVersion;

  for (const source of sources) {
    const match = source.repositoryPath.match(POST_REPLAY_MIGRATION);
    const version = match?.[1];
    if (!version) {
      throw new Error(
        `Post-replay source must be a safe top-level SQL migration: ${source.repositoryPath}`
      );
    }
    if (paths.has(source.repositoryPath)) {
      throw new Error(
        `Post-replay duplicate migration path: ${source.repositoryPath}`
      );
    }
    if (versions.has(version)) {
      throw new Error(`Post-replay duplicate migration version: ${version}`);
    }
    if (version <= frozenReplayTailVersion) {
      throw new Error(
        `Post-replay migration version must be after the frozen replay tail: ${version}`
      );
    }
    if (version <= previousVersion) {
      throw new Error(
        `Post-replay migration versions must be strictly ordered: ${version}`
      );
    }
    if (!SHA_256.test(source.sha256)) {
      throw new Error(
        `Post-replay source has an invalid SHA-256: ${source.repositoryPath}`
      );
    }

    const sourcePath = await resolveSafeReplayPath(root, source.repositoryPath);
    if (!(await lstat(sourcePath)).isFile()) {
      throw new Error(
        `Post-replay source must be a regular file: ${source.repositoryPath}`
      );
    }
    const body = await readFile(sourcePath);
    if (sha256(body) !== source.sha256) {
      throw new Error(
        `Post-replay source SHA-256 drift: ${source.repositoryPath}`
      );
    }

    paths.add(source.repositoryPath);
    versions.add(version);
    previousVersion = version;
    verified.push({
      receiptId: `post-replay:${source.repositoryPath}`,
      repositoryPath: source.repositoryPath,
      sha256: source.sha256,
    });
  }

  return verified;
}
