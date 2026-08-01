import { lstat } from 'node:fs/promises';
import { dirname, parse } from 'node:path';

/** Rejects symlinked authority ancestors before any artifact or marker access. */
export async function assertNoSymlinkAncestors(path: string, label: string) {
  const root = parse(path).root;
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
  }
}
