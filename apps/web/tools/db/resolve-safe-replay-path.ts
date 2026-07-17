import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

export async function resolveSafeReplayPath(
  root: string,
  repositoryPath: string,
  mustExist = true
): Promise<string> {
  if (
    repositoryPath.startsWith('/') ||
    repositoryPath.includes('\\') ||
    repositoryPath.split('/').includes('..') ||
    path.posix.normalize(repositoryPath) !== repositoryPath
  ) {
    throw new Error(`Unsafe repository path: ${repositoryPath}`);
  }
  const canonicalRoot = await realpath(path.resolve(root));
  const candidate = path.resolve(canonicalRoot, repositoryPath);
  if (
    candidate !== canonicalRoot &&
    !candidate.startsWith(`${canonicalRoot}${path.sep}`)
  ) {
    throw new Error(`Repository path escapes workspace: ${repositoryPath}`);
  }
  const comparisonPath = mustExist ? candidate : path.dirname(candidate);
  const resolved = await realpath(comparisonPath);
  if (
    resolved !== canonicalRoot &&
    !resolved.startsWith(`${canonicalRoot}${path.sep}`)
  ) {
    throw new Error(
      `Repository path resolves outside workspace: ${repositoryPath}`
    );
  }
  if (mustExist && (await lstat(candidate)).isSymbolicLink()) {
    throw new Error(
      `Repository source may not be a symlink: ${repositoryPath}`
    );
  }
  return candidate;
}
