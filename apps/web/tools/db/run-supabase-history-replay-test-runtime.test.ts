import { describe, expect, it, vi } from 'vitest';
import { createSupabaseReplayRuntimeFixture } from './run-supabase-history-replay-test-runtime';
import type { ReplayCommand } from './supabase-history-replay-types';

describe('createSupabaseReplayRuntimeFixture', () => {
  it('provides enforce defaults and non-converged classify evidence', async () => {
    const fixture = createSupabaseReplayRuntimeFixture();
    expect(fixture.replayOptions()).toMatchObject({
      comparisonMode: 'enforce',
      mode: 'chronological',
    });
    await expect(
      fixture.deps.verifyEffects({
        comparisonMode: 'classify',
        databaseUrl: fixture.databaseUrl,
        psqlBin: '/owned/psql',
        readEffects: fixture.deps.readEffects,
        repositoryRoot: fixture.root,
        runCommand: vi.fn<ReplayCommand>(),
      })
    ).resolves.toMatchObject({
      comparison: { converged: false, mode: 'classify' },
    });
  });
});
