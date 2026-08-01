import { lstat } from 'node:fs/promises';
import { dirname, parse } from 'node:path';

export type AuthorityAncestorSnapshot = Readonly<{
  path: string;
  dev: number;
  ino: number;
  mode: number;
}>;

/** Rejects symlinked authority ancestors before any artifact or marker access. */
export async function captureAuthorityAncestors(
  path: string,
  label: string
): Promise<readonly AuthorityAncestorSnapshot[]> {
  const root = parse(path).root;
  const snapshots: AuthorityAncestorSnapshot[] = [];
  for (
    let current = dirname(path);
    current !== root;
    current = dirname(current)
  ) {
    const stat = await lstat(current).catch(() => {
      throw new Error(`${label} authority scope is not readable`);
    });
    if (stat.isSymbolicLink())
      throw new Error(`${label} authority path must not traverse a symlink`);
    snapshots.push({
      path: current,
      dev: Number(stat.dev),
      ino: Number(stat.ino),
      mode: Number(stat.mode),
    });
  }
  return snapshots;
}

export async function assertNoSymlinkAncestors(path: string, label: string) {
  await captureAuthorityAncestors(path, label);
}

/** Rejects an authority path whose ancestors changed after an operation began. */
export async function assertAuthorityAncestorsUnchanged(
  path: string,
  label: string,
  before: readonly AuthorityAncestorSnapshot[]
) {
  const after = await captureAuthorityAncestors(path, label);
  if (
    after.length !== before.length ||
    after.some((snapshot, index) => {
      const previous = before[index];
      return (
        !previous ||
        snapshot.path !== previous.path ||
        snapshot.dev !== previous.dev ||
        snapshot.ino !== previous.ino ||
        snapshot.mode !== previous.mode
      );
    })
  )
    throw new Error(`${label} authority path changed during access`);
}
