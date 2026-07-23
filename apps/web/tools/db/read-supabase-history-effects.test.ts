import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { readSupabaseHistoryEffects } from './read-supabase-history-effects';
import { createSupabaseHistoryEffectTestFixture } from './supabase-history-effect-test-fixture';

const querySha256 = (query: string) =>
  createHash('sha256').update(query).digest('hex');

function executorFor(snapshot: unknown) {
  return vi
    .fn()
    .mockResolvedValueOnce([
      { serverVersionNum: 170006, transactionReadOnly: 'on' },
    ])
    .mockResolvedValueOnce([{ snapshot }]);
}

function readSnapshot(
  snapshot: unknown = createSupabaseHistoryEffectTestFixture(),
  effectQuery = 'SELECT 1'
) {
  return readSupabaseHistoryEffects({
    effectQuery,
    executeSelect: executorFor(snapshot),
    expectedEffectQuerySha256: querySha256(effectQuery),
  });
}

describe('readSupabaseHistoryEffects', () => {
  it('preflights, validates the exact scope, and returns only safe digests and summary', async () => {
    const executeSelect = executorFor(createSupabaseHistoryEffectTestFixture());
    const result = await readSupabaseHistoryEffects({
      effectQuery: 'WITH exact AS (SELECT 1) SELECT 1',
      executeSelect,
      expectedEffectQuerySha256: querySha256(
        'WITH exact AS (SELECT 1) SELECT 1'
      ),
    });

    expect(executeSelect.mock.calls[0]?.[0]).toBe(
      'SELECT current_setting(\'server_version_num\')::int AS "serverVersionNum", current_setting(\'transaction_read_only\') AS "transactionReadOnly"'
    );
    expect(result).toMatchObject({
      diagnostics: {
        extensionVersions: [
          { name: 'pgcrypto', schema: 'extensions', version: '1.3' },
          { name: 'pgmq', schema: 'pgmq', version: '1.5.1' },
        ],
      },
      effects: {
        componentCount: 76,
        domainEventRpcCount: 19,
        eventPolicyRolesExact: true,
        merchantAnonProjectionExact: true,
        pgmqProtectedRolesWithheld: true,
      },
      scopeVersion: 'baci-p0-effects-v3',
      serverVersionNum: 170006,
    });
    expect(result.digestVector).toHaveLength(76);
    expect(result.effectSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result).not.toHaveProperty('components');
    expect(JSON.stringify(result)).not.toContain('CREATE FUNCTION');
  });

  it('is input-order invariant and excludes diagnostic extension versions from hashes', async () => {
    const firstSnapshot = createSupabaseHistoryEffectTestFixture();
    const secondSnapshot = createSupabaseHistoryEffectTestFixture();
    secondSnapshot.components.reverse();
    secondSnapshot.diagnostics.extensionVersions[0].version = '1.4';

    const first = await readSnapshot(firstSnapshot);
    const second = await readSnapshot(secondSnapshot);
    expect(first.effectSha256).toBe(second.effectSha256);
    expect(first.digestVector).toEqual(second.digestVector);
    expect(first.diagnostics).not.toEqual(second.diagnostics);
  });

  it('changes exactly one digest for one component value change', async () => {
    const baseline = await readSnapshot();
    const changed = await readSnapshot(
      createSupabaseHistoryEffectTestFixture({
        overrides: [
          {
            category: 'function',
            identity:
              'public.cancel_order_as_customer(p_order_id uuid, p_reason text)',
            value: { definition: 'changed without being returned' },
          },
        ],
      })
    );
    const changedDigests = changed.digestVector.filter(
      (digest, index) => digest.sha256 !== baseline.digestVector[index]?.sha256
    );
    expect(changedDigests).toEqual([
      expect.objectContaining({
        category: 'function',
        identity:
          'public.cancel_order_as_customer(p_order_id uuid, p_reason text)',
      }),
    ]);
    expect(JSON.stringify(changed)).not.toContain(
      'changed without being returned'
    );
  });

  it('rejects missing, additional, and unsafe components before hashing', async () => {
    const missing = createSupabaseHistoryEffectTestFixture();
    missing.components.pop();
    await expect(readSnapshot(missing)).rejects.toThrow(
      'effect snapshot scope mismatch'
    );

    const additional = createSupabaseHistoryEffectTestFixture();
    additional.components.push({
      category: 'function',
      identity: 'public.unreviewed()',
      value: {},
    });
    await expect(readSnapshot(additional)).rejects.toThrow(
      'effect snapshot scope mismatch'
    );

    const unsafe = createSupabaseHistoryEffectTestFixture({
      overrides: [
        {
          category: 'policy',
          identity:
            'public.analytics_events.Event ingress capability inserts analytics events',
          value: { enabled: true, roles: ['PUBLIC'] },
        },
      ],
    });
    await expect(readSnapshot(unsafe)).rejects.toThrow(
      'effect snapshot safety mismatch'
    );
  });

  it.each([
    [{ serverVersionNum: 170010, transactionReadOnly: 'on' }],
    [{ serverVersionNum: 170006, transactionReadOnly: 'off' }],
  ])('fails before the effect query when preflight is not exact', async (preflight) => {
    const executeSelect = vi.fn().mockResolvedValue(preflight);
    await expect(
      readSupabaseHistoryEffects({
        effectQuery: 'SELECT 1',
        executeSelect,
        expectedEffectQuerySha256: querySha256('SELECT 1'),
      })
    ).rejects.toThrow('server version preflight mismatch');
    expect(executeSelect).toHaveBeenCalledTimes(1);
  });

  it('rejects unreviewed or mutating SQL before database access and sanitizes failures', async () => {
    const executeSelect = vi.fn();
    await expect(
      readSupabaseHistoryEffects({
        effectQuery: 'SELECT 1',
        executeSelect,
        expectedEffectQuerySha256: '0'.repeat(64),
      })
    ).rejects.toThrow('Reviewed effect query drift');
    for (const effectQuery of [
      'SELECT 1; DELETE FROM public.orders',
      'SELECT secret INTO private.captured FROM public.merchants',
    ]) {
      await expect(
        readSupabaseHistoryEffects({
          effectQuery,
          executeSelect,
          expectedEffectQuerySha256: querySha256(effectQuery),
        })
      ).rejects.toThrow('effect query is not SELECT-only');
    }
    expect(executeSelect).not.toHaveBeenCalled();

    const credential = 'postgresql://user:secret@example.test/database';
    const failedPreflight = vi.fn().mockRejectedValue(new Error(credential));
    await expect(
      readSupabaseHistoryEffects({
        effectQuery: 'SELECT 1',
        executeSelect: failedPreflight,
        expectedEffectQuerySha256: querySha256('SELECT 1'),
      })
    ).rejects.not.toThrow(credential);

    const failedEffectQuery = vi
      .fn()
      .mockResolvedValueOnce([
        { serverVersionNum: 170006, transactionReadOnly: 'on' },
      ])
      .mockRejectedValueOnce(new Error(credential));
    await expect(
      readSupabaseHistoryEffects({
        effectQuery: 'SELECT 1',
        executeSelect: failedEffectQuery,
        expectedEffectQuerySha256: querySha256('SELECT 1'),
      })
    ).rejects.toThrow('effect snapshot query failed');
    expect(failedEffectQuery).toHaveBeenCalledTimes(2);

    await expect(
      readSnapshot({ credential, scopeVersion: 'baci-p0-effects-v3' })
    ).rejects.toThrow('effect snapshot failed strict validation');
  });
});
