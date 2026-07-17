import { describe, expect, it } from 'vitest';
import { compareSupabaseHistoryEffectDigests } from './compare-supabase-history-effect-digests';

const productionEffectSha256 = 'f'.repeat(64);
const base = [
  { category: 'function', identity: 'public.alpha()', sha256: 'a'.repeat(64) },
  {
    category: 'policy',
    identity: 'public.orders.read',
    sha256: 'b'.repeat(64),
  },
];

describe('compareSupabaseHistoryEffectDigests', () => {
  it('returns convergence only for an identical enforce comparison', () => {
    expect(
      compareSupabaseHistoryEffectDigests({
        localDigestVector: [...base].reverse(),
        mode: 'enforce',
        productionDigestVector: base,
        productionEffectSha256,
      })
    ).toEqual({
      changedComponents: [],
      converged: true,
      mode: 'enforce',
      productionEffectSha256,
    });
    expect(
      compareSupabaseHistoryEffectDigests({
        localDigestVector: base,
        mode: 'classify',
        productionDigestVector: base,
        productionEffectSha256,
      })
    ).toEqual({
      changedComponents: [],
      converged: false,
      mode: 'classify',
      productionEffectSha256,
    });
  });

  it('classifies changed, missing, and additional components without raw values', () => {
    const comparison = compareSupabaseHistoryEffectDigests({
      localDigestVector: [
        {
          category: 'function',
          identity: 'public.alpha()',
          sha256: 'c'.repeat(64),
        },
        {
          category: 'trigger',
          identity: 'public.orders.audit',
          sha256: 'd'.repeat(64),
        },
      ],
      mode: 'classify',
      productionDigestVector: base,
      productionEffectSha256,
    });

    expect(comparison).toEqual({
      changedComponents: [
        {
          category: 'function',
          identity: 'public.alpha()',
          localSha256: 'c'.repeat(64),
          productionSha256: 'a'.repeat(64),
        },
        {
          category: 'policy',
          identity: 'public.orders.read',
          localSha256: null,
          productionSha256: 'b'.repeat(64),
        },
        {
          category: 'trigger',
          identity: 'public.orders.audit',
          localSha256: 'd'.repeat(64),
          productionSha256: null,
        },
      ],
      converged: false,
      mode: 'classify',
      productionEffectSha256,
    });
    expect(JSON.stringify(comparison)).not.toContain('CREATE FUNCTION');
  });

  it('rejects drift in enforce mode and duplicate vector identities', () => {
    expect(() =>
      compareSupabaseHistoryEffectDigests({
        localDigestVector: [{ ...base[0], sha256: 'c'.repeat(64) }, base[1]],
        mode: 'enforce',
        productionDigestVector: base,
        productionEffectSha256,
      })
    ).toThrow('production effect receipt mismatch');
    expect(() =>
      compareSupabaseHistoryEffectDigests({
        localDigestVector: [base[0], base[0]],
        mode: 'classify',
        productionDigestVector: base,
        productionEffectSha256,
      })
    ).toThrow('duplicate effect digest identity');
  });
});
