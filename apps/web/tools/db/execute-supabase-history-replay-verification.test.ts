import { describe, expect, it, vi } from 'vitest';
import { executeSupabaseHistoryReplayVerification } from './execute-supabase-history-replay-verification';
import type { ReplayCommand } from './supabase-history-replay-types';

const effectSha256 = 'a'.repeat(64);
const productionEffectSha256 = 'b'.repeat(64);
const cancellationIdentity =
  'public.cancel_order_as_customer(p_order_id uuid, p_reason text)';
const productionCancellationSha256 = 'c'.repeat(64);
const repairedCancellationSha256 = 'd'.repeat(64);
const digestVector = [
  {
    category: 'function',
    identity: cancellationIdentity,
    sha256: repairedCancellationSha256,
  },
  ...Array.from({ length: 75 }, (_, index) => ({
    category: 'policy',
    identity: `public.test_policy_${String(index).padStart(2, '0')}`,
    sha256: String(index % 10).repeat(64),
  })),
];
const productionOldCancellationProof = {
  productionSha256: productionCancellationSha256,
  repairedSha256: repairedCancellationSha256,
  verified: true as const,
};
const options = {
  comparisonMode: 'enforce' as const,
  databaseUrl: 'postgresql://postgres:secret@127.0.0.1:6543/postgres',
  psqlBin: '/owned/psql',
  readEffects: vi.fn(async () => ({
    comparison: {
      changedComponents: [],
      converged: true,
      mode: 'enforce' as const,
      productionEffectSha256,
    },
    digestVector,
    effectSha256,
    serverVersionNum: 170006,
  })),
  productionOldCancellationProof,
  repositoryRoot: '/repository',
  runCommand: vi.fn<ReplayCommand>(),
};

describe('executeSupabaseHistoryReplayVerification', () => {
  it('preserves ordinary replay verification when the production-old proof is skipped', async () => {
    await expect(
      executeSupabaseHistoryReplayVerification({
        ...options,
        productionOldCancellationProof: undefined,
      })
    ).resolves.toMatchObject({
      comparison: {
        changedComponents: [],
        converged: true,
        mode: 'enforce',
      },
      effectSha256,
      serverVersionNum: 170006,
    });
  });

  it('accepts only an enforce comparison that proves convergence', async () => {
    await expect(
      executeSupabaseHistoryReplayVerification(options)
    ).resolves.toEqual({
      comparison: {
        changedComponents: [],
        converged: true,
        mode: 'enforce',
        productionEffectSha256,
      },
      effectSha256,
      serverVersionNum: 170006,
    });
    expect(options.readEffects).toHaveBeenCalledWith({
      comparisonMode: 'enforce',
      databaseUrl: options.databaseUrl,
      psqlBin: options.psqlBin,
      repositoryRoot: options.repositoryRoot,
      runCommand: options.runCommand,
    });
  });

  it('returns classify diagnostics but stamps them non-converged', async () => {
    const readEffects = vi.fn(async () => ({
      comparison: {
        changedComponents: [
          {
            category: 'function',
            identity: cancellationIdentity,
            localSha256: repairedCancellationSha256,
            productionSha256: productionCancellationSha256,
          },
        ],
        converged: false,
        mode: 'classify',
        productionEffectSha256,
      },
      digestVector,
      effectSha256,
      serverVersionNum: 170006,
    }));
    await expect(
      executeSupabaseHistoryReplayVerification({
        ...options,
        comparisonMode: 'classify',
        readEffects,
      })
    ).resolves.toMatchObject({
      comparison: {
        changedComponents: [
          {
            category: 'function',
            identity: cancellationIdentity,
          },
        ],
        converged: false,
        mode: 'classify',
      },
    });
  });

  it.each([
    {},
    {
      comparison: {
        changedComponents: [],
        converged: true,
        mode: 'classify',
        productionEffectSha256,
      },
      digestVector,
      effectSha256,
      serverVersionNum: 170006,
    },
    {
      comparison: {
        changedComponents: [],
        converged: false,
        mode: 'enforce',
        productionEffectSha256,
      },
      digestVector,
      effectSha256,
      serverVersionNum: 170006,
    },
    {
      comparison: {
        changedComponents: [],
        converged: true,
        mode: 'enforce',
        productionEffectSha256,
      },
      digestVector,
      effectSha256,
      serverVersionNum: 170005,
    },
  ])('rejects missing, mismatched, or non-final effect evidence', async (result) => {
    await expect(
      executeSupabaseHistoryReplayVerification({
        ...options,
        readEffects: vi.fn(async () => result),
      })
    ).rejects.toThrow('Supabase replay effect verification failed');
  });

  it('rejects a proof whose repaired digest is not the local cancellation digest', async () => {
    await expect(
      executeSupabaseHistoryReplayVerification({
        ...options,
        productionOldCancellationProof: {
          ...productionOldCancellationProof,
          repairedSha256: 'e'.repeat(64),
        },
      })
    ).rejects.toThrow('Supabase replay effect verification failed');
  });

  it('rejects classify evidence whose production cancellation digest is not the frozen proof digest', async () => {
    const readEffects = vi.fn(async () => ({
      comparison: {
        changedComponents: [
          {
            category: 'function',
            identity: cancellationIdentity,
            localSha256: repairedCancellationSha256,
            productionSha256: 'e'.repeat(64),
          },
        ],
        converged: false,
        mode: 'classify' as const,
        productionEffectSha256,
      },
      digestVector,
      effectSha256,
      serverVersionNum: 170006,
    }));

    await expect(
      executeSupabaseHistoryReplayVerification({
        ...options,
        comparisonMode: 'classify',
        readEffects,
      })
    ).rejects.toThrow('Supabase replay effect verification failed');
  });

  it('rejects classify evidence that omits the cancellation drift row', async () => {
    const readEffects = vi.fn(async () => ({
      comparison: {
        changedComponents: [
          {
            category: 'function',
            identity: 'public.unrelated()',
            localSha256: repairedCancellationSha256,
            productionSha256: productionCancellationSha256,
          },
        ],
        converged: false,
        mode: 'classify' as const,
        productionEffectSha256,
      },
      digestVector,
      effectSha256,
      serverVersionNum: 170006,
    }));

    await expect(
      executeSupabaseHistoryReplayVerification({
        ...options,
        comparisonMode: 'classify',
        readEffects,
      })
    ).rejects.toThrow('Supabase replay effect verification failed');
  });

  it('rejects duplicate cancellation digest identities', async () => {
    const duplicateDigestVector = digestVector.map((digest, index) =>
      index === 1
        ? {
            category: 'function',
            identity: cancellationIdentity,
            sha256: repairedCancellationSha256,
          }
        : digest
    );

    await expect(
      executeSupabaseHistoryReplayVerification({
        ...options,
        readEffects: vi.fn(async () => ({
          comparison: {
            changedComponents: [],
            converged: true,
            mode: 'enforce' as const,
            productionEffectSha256,
          },
          digestVector: duplicateDigestVector,
          effectSha256,
          serverVersionNum: 170006,
        })),
      })
    ).rejects.toThrow('Supabase replay effect verification failed');
  });
});
