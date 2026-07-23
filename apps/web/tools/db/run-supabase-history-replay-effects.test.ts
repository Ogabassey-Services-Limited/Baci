import { describe, expect, it, vi } from 'vitest';
import { runSupabaseHistoryReplay } from './run-supabase-history-replay';
import { createSupabaseReplayRuntimeFixture } from './run-supabase-history-replay-test-runtime';

describe('runSupabaseHistoryReplay effect comparison', () => {
  it('threads classify mode into verification and emits a non-final receipt', async () => {
    const fixture = createSupabaseReplayRuntimeFixture();
    const receipt = await runSupabaseHistoryReplay(
      fixture.replayOptions('production-effect', 'classify'),
      fixture.deps
    );

    expect(fixture.deps.verifyEffects).toHaveBeenCalledWith({
      comparisonMode: 'classify',
      databaseUrl: fixture.databaseUrl,
      psqlBin: '/opt/homebrew/opt/libpq/bin/psql',
      productionOldCancellationProof: undefined,
      readEffects: fixture.deps.readEffects,
      repositoryRoot: fixture.root,
      runCommand: expect.any(Function),
    });
    expect(receipt.comparison).toEqual({
      changedComponents: [],
      converged: false,
      mode: 'classify',
      productionEffectSha256: 'a'.repeat(64),
    });
  });

  it.each([
    'chronological',
    'production-effect',
  ] as const)('binds the required production-old cancellation proof into %s verification and receipt', async (mode) => {
    const fixture = createSupabaseReplayRuntimeFixture();
    const receipt = await runSupabaseHistoryReplay(
      fixture.replayOptions(mode, 'classify', 'required'),
      fixture.deps
    );
    const proof = {
      productionSha256: 'b'.repeat(64),
      repairedSha256: 'c'.repeat(64),
      verified: true as const,
    };

    expect(fixture.deps.verifyProductionOldCancellation).toHaveBeenCalledOnce();
    expect(fixture.deps.verifyEffects).toHaveBeenCalledWith({
      comparisonMode: 'classify',
      databaseUrl: fixture.databaseUrl,
      productionOldCancellationProof: proof,
      psqlBin: '/opt/homebrew/opt/libpq/bin/psql',
      readEffects: fixture.deps.readEffects,
      repositoryRoot: fixture.root,
      runCommand: expect.any(Function),
    });
    expect(receipt.productionOldCancellationProof).toEqual(proof);
    expect(receipt).not.toHaveProperty('digestVector');
  });

  it('aborts before effect verification and receipt emission when the required proof fails', async () => {
    const fixture = createSupabaseReplayRuntimeFixture();
    vi.mocked(
      fixture.deps.verifyProductionOldCancellation
    ).mockRejectedValueOnce(
      new Error('Production-old cancellation proof failed: mismatch')
    );

    await expect(
      runSupabaseHistoryReplay(
        {
          ...fixture.replayOptions('chronological', 'classify', 'required'),
          receiptOutput: 'proof-receipt.json',
          typesOutput: 'database.types.ts',
        },
        fixture.deps
      )
    ).rejects.toThrow('Production-old cancellation proof failed: mismatch');
    expect(fixture.deps.verifyEffects).not.toHaveBeenCalled();
    expect(fixture.writes).toEqual([]);
    expect(fixture.commands).not.toContainEqual(
      expect.stringContaining('supabase gen')
    );
    expect(fixture.removed).toEqual([fixture.workdir]);
  });
});
