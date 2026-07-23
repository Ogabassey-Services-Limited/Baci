import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { materializeSupabaseHistoryReplay } from './materialize-supabase-history-replay';
import { verifySupabaseHistoryReplayManifest } from './verify-supabase-history-replay-manifest';

const workspaceRoot = path.resolve(import.meta.dirname, '../../../..');

describe('materializeSupabaseHistoryReplay ordering', () => {
  it('breaks same-version filename ties with deterministic code-unit order', async () => {
    const verified = await verifySupabaseHistoryReplayManifest(workspaceRoot, {
      pendingRepairState: 'materialized',
    });
    const tied = structuredClone(verified);
    tied.verifiedSources = tied.verifiedSources.map((source, index) => {
      if (index > 1) return source;
      const suffix = index === 0 ? 'a' : 'A';
      return {
        ...source,
        repositoryPath: `supabase/migrations/19000101000000_${suffix}.sql`,
      };
    });

    expect(
      materializeSupabaseHistoryReplay(tied, 'chronological')
        .filter(({ repositoryPath }) =>
          repositoryPath.includes('19000101000000_')
        )
        .map(({ repositoryPath }) => path.posix.basename(repositoryPath))
    ).toEqual(['19000101000000_A.sql', '19000101000000_a.sql']);
  }, 60_000);
});
