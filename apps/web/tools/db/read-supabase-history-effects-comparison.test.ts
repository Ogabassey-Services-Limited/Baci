import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { readSupabaseHistoryEffects } from './read-supabase-history-effects';
import { productionHistoryEffectsSchema } from './schemas/production-history-effects-schema';
import { createSupabaseHistoryEffectTestFixture } from './supabase-history-effect-test-fixture';

const EFFECT_QUERY = 'SELECT 1';
const QUERY_SHA256 = createHash('sha256').update(EFFECT_QUERY).digest('hex');

function executorFor(snapshot: unknown) {
  return vi
    .fn()
    .mockResolvedValueOnce([
      { serverVersionNum: 170006, transactionReadOnly: 'on' },
    ])
    .mockResolvedValueOnce([{ snapshot }]);
}

async function readWithoutProduction(
  snapshot = createSupabaseHistoryEffectTestFixture()
) {
  return readSupabaseHistoryEffects({
    effectQuery: EFFECT_QUERY,
    executeSelect: executorFor(snapshot),
    expectedEffectQuerySha256: QUERY_SHA256,
  });
}

async function buildProductionFixture() {
  const baseline = await readWithoutProduction();
  return productionHistoryEffectsSchema.parse({
    baseSha: '9e3d1b14b1931a5e441fc23f0e5417c188056e47',
    diagnostics: {
      extensionVersions: [
        { name: 'pgcrypto', schema: 'extensions', version: '1.3' },
        { name: 'pgmq', schema: 'pgmq', version: '1.5.1' },
      ],
    },
    digestVector: baseline.digestVector,
    effectSha256: baseline.effectSha256,
    effects: baseline.effects,
    ledger: { rowCount: 442, tailVersion: '20260714225503' },
    schemaVersion: 2,
    scope: {
      componentCount: 76,
      manifestSha256:
        'a216397b8fcc2cd0cac6f7a66023582f43b0c5e348501a94d00d771da1084245',
      version: 'baci-p0-effects-v3',
    },
    source: {
      kind: 'supabase-management-api-read-only',
      querySha256: QUERY_SHA256,
      serverVersionNum: 170006,
    },
  });
}

describe('readSupabaseHistoryEffects production comparison', () => {
  it('defaults to enforce and returns a converged secret-safe receipt', async () => {
    const production = await buildProductionFixture();
    const result = await readSupabaseHistoryEffects({
      effectQuery: EFFECT_QUERY,
      executeSelect: executorFor(createSupabaseHistoryEffectTestFixture()),
      expectedEffectQuerySha256: QUERY_SHA256,
      productionFixture: JSON.stringify(production),
    });

    expect(result.comparison).toEqual({
      changedComponents: [],
      converged: true,
      mode: 'enforce',
      productionEffectSha256: production.effectSha256,
    });
    expect(JSON.stringify(result)).not.toContain('CREATE FUNCTION');
  });

  it('classifies exactly one changed component without raw values', async () => {
    const production = await buildProductionFixture();
    const local = createSupabaseHistoryEffectTestFixture({
      overrides: [
        {
          category: 'function',
          identity:
            'public.cancel_order_as_customer(p_order_id uuid, p_reason text)',
          value: { definition: 'local changed definition' },
        },
      ],
    });
    const result = await readSupabaseHistoryEffects({
      comparisonMode: 'classify',
      effectQuery: EFFECT_QUERY,
      executeSelect: executorFor(local),
      expectedEffectQuerySha256: QUERY_SHA256,
      productionFixture: JSON.stringify(production),
    });

    expect(result.comparison).toEqual({
      changedComponents: [
        {
          category: 'function',
          identity:
            'public.cancel_order_as_customer(p_order_id uuid, p_reason text)',
          localSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          productionSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      converged: false,
      mode: 'classify',
      productionEffectSha256: production.effectSha256,
    });
    expect(JSON.stringify(result)).not.toContain('local changed definition');
  });

  it('rejects the same component drift in enforce mode', async () => {
    const production = await buildProductionFixture();
    const local = createSupabaseHistoryEffectTestFixture({
      overrides: [
        {
          category: 'function',
          identity:
            'public.cancel_order_as_customer(p_order_id uuid, p_reason text)',
          value: { definition: 'local changed definition' },
        },
      ],
    });

    await expect(
      readSupabaseHistoryEffects({
        effectQuery: EFFECT_QUERY,
        executeSelect: executorFor(local),
        expectedEffectQuerySha256: QUERY_SHA256,
        productionFixture: JSON.stringify(production),
      })
    ).rejects.toThrow('production effect receipt mismatch');
  });

  it('rejects malformed or query-mismatched fixtures before database access', async () => {
    const production = await buildProductionFixture();
    const credential = 'postgresql://user:secret@example.test/database';
    for (const fixture of [
      JSON.stringify({ ...production, schemaVersion: 1 }),
      JSON.stringify({
        ...production,
        source: { ...production.source, querySha256: '0'.repeat(64) },
      }),
      JSON.stringify({ credential }),
    ]) {
      const executeSelect = vi.fn();
      await expect(
        readSupabaseHistoryEffects({
          effectQuery: EFFECT_QUERY,
          executeSelect,
          expectedEffectQuerySha256: QUERY_SHA256,
          productionFixture: fixture,
        })
      ).rejects.toThrow('production effect receipt mismatch');
      expect(executeSelect).not.toHaveBeenCalled();
    }

    const executeSelect = vi.fn();
    await expect(
      readSupabaseHistoryEffects({
        comparisonMode: 'classify',
        effectQuery: EFFECT_QUERY,
        executeSelect,
        expectedEffectQuerySha256: QUERY_SHA256,
      })
    ).rejects.toThrow('production effect receipt mismatch');
    expect(executeSelect).not.toHaveBeenCalled();
  });

  it('reports extension-version drift without changing convergence', async () => {
    const production = await buildProductionFixture();
    const local = createSupabaseHistoryEffectTestFixture();
    local.diagnostics.extensionVersions[0].version = '1.4';
    const result = await readSupabaseHistoryEffects({
      effectQuery: EFFECT_QUERY,
      executeSelect: executorFor(local),
      expectedEffectQuerySha256: QUERY_SHA256,
      productionFixture: JSON.stringify(production),
    });

    expect(result.comparison?.converged).toBe(true);
    expect(result.effectSha256).toBe(production.effectSha256);
    expect(result.diagnostics).toMatchObject({
      extensionVersionDrift: true,
      productionExtensionVersions: production.diagnostics.extensionVersions,
    });
  });
});
