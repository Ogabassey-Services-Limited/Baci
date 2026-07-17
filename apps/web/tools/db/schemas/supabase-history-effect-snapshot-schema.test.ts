import { describe, expect, it } from 'vitest';
import { supabaseHistoryEffectSnapshotSchema } from './supabase-history-effect-snapshot-schema';

function makeSnapshot(): Record<string, unknown> {
  return {
    scopeVersion: 'baci-p0-effects-v3',
    serverVersionNum: 170006,
    components: [
      {
        category: 'extension',
        identity: 'extensions.pgcrypto',
        value: { name: 'pgcrypto', schema: 'extensions' },
      },
    ],
    diagnostics: {
      extensionVersions: [
        { name: 'pgcrypto', schema: 'extensions', version: '1.3' },
        { name: 'pgmq', schema: 'pgmq', version: '1.5.1' },
      ],
    },
  };
}

describe('supabaseHistoryEffectSnapshotSchema', () => {
  it('accepts the strict v3 component envelope', () => {
    expect(
      supabaseHistoryEffectSnapshotSchema.parse(makeSnapshot())
    ).toMatchObject({
      scopeVersion: 'baci-p0-effects-v3',
      serverVersionNum: 170006,
    });
  });

  it('rejects old scope versions, unknown fields, and mutable diagnostics', () => {
    expect(
      supabaseHistoryEffectSnapshotSchema.safeParse({
        ...makeSnapshot(),
        scopeVersion: 'baci-owned-effects-v2',
      }).success
    ).toBe(false);
    expect(
      supabaseHistoryEffectSnapshotSchema.safeParse({
        ...makeSnapshot(),
        rawCatalog: 'forbidden',
      }).success
    ).toBe(false);
    const snapshot = makeSnapshot();
    snapshot.diagnostics = {
      extensionVersions: [
        {
          name: 'pgcrypto',
          schema: 'extensions',
          version: '1.3',
          installedAt: '2026-07-16T00:00:00Z',
        },
        { name: 'pgmq', schema: 'pgmq', version: '1.5.1' },
      ],
    };
    expect(
      supabaseHistoryEffectSnapshotSchema.safeParse(snapshot).success
    ).toBe(false);
  });

  it('requires exactly the two ordered extension diagnostic identities', () => {
    const missing = makeSnapshot();
    (
      missing.diagnostics as { extensionVersions: unknown[] }
    ).extensionVersions.pop();
    expect(supabaseHistoryEffectSnapshotSchema.safeParse(missing).success).toBe(
      false
    );

    const additional = makeSnapshot();
    (
      additional.diagnostics as { extensionVersions: unknown[] }
    ).extensionVersions.push({
      name: 'postgis',
      schema: 'extensions',
      version: '3.3.7',
    });
    expect(
      supabaseHistoryEffectSnapshotSchema.safeParse(additional).success
    ).toBe(false);

    const reordered = makeSnapshot();
    (
      reordered.diagnostics as { extensionVersions: unknown[] }
    ).extensionVersions.reverse();
    expect(
      supabaseHistoryEffectSnapshotSchema.safeParse(reordered).success
    ).toBe(false);
  });
});
