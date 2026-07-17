import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { resolveSafeReplayPath } from './resolve-safe-replay-path';
import type { ForwardReplayRepair } from './supabase-history-replay-types';

export async function verifySupabaseForwardRepairs(
  root: string,
  repairs: readonly ForwardReplayRepair[]
): Promise<void> {
  const paths = repairs.map(({ path }) => path);
  const identities = repairs.map(
    ({ changedComponent }) =>
      `${changedComponent.category}:${changedComponent.identity}`
  );
  if (
    repairs.length !== 2 ||
    new Set(paths).size !== paths.length ||
    new Set(identities).size !== identities.length
  ) {
    throw new Error('Forward repair manifest drift');
  }
  for (const repair of repairs) {
    const repairPath = await resolveSafeReplayPath(root, repair.path, false);
    const exists = await lstat(repairPath).then(
      () => true,
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return false;
        throw error;
      }
    );
    if (!exists) throw new Error(`Forward repair must exist: ${repair.path}`);
    const body = await readFile(await resolveSafeReplayPath(root, repair.path));
    const actualSha256 = createHash('sha256').update(body).digest('hex');
    if (actualSha256 !== repair.sha256) {
      throw new Error(`Forward repair SHA-256 mismatch: ${repair.path}`);
    }
  }
}
