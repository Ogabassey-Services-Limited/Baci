import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { resolveSafeReplayPath } from './resolve-safe-replay-path';

export async function verifyCurrentMigrationRegistry(
  root: string,
  expectedPaths: readonly string[]
): Promise<void> {
  const migrationRoot = await resolveSafeReplayPath(
    root,
    'supabase/migrations'
  );
  const currentNames = (await readdir(migrationRoot, { withFileTypes: true }))
    .filter((entry) => entry.name.endsWith('.sql'))
    .map(({ name }) => name)
    .sort();
  const expectedNames = expectedPaths
    .map((entry) => path.posix.basename(entry))
    .sort();
  if (JSON.stringify(currentNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      'Current top-level migration registry differs from the explicit pending-repair state'
    );
  }
}
