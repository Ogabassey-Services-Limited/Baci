import { describe, expect, it } from 'vitest';
import { resolveSupabaseHistoryFixturePersistenceMode } from './resolve-supabase-history-fixture-persistence-mode';

describe('resolveSupabaseHistoryFixturePersistenceMode', () => {
  it.each([
    [{}, 'create'],
    [{ refreshEffectsFixture: true }, 'refresh-effects'],
    [{ refreshPostDeploy: true }, 'refresh-post-deploy'],
    [{ verifyOnly: true }, 'verify'],
  ] as const)('resolves one capture mode', (options, expected) => {
    expect(resolveSupabaseHistoryFixturePersistenceMode(options)).toBe(
      expected
    );
  });

  it('rejects multiple capture modes', () => {
    expect(() =>
      resolveSupabaseHistoryFixturePersistenceMode({
        refreshPostDeploy: true,
        verifyOnly: true,
      })
    ).toThrow('Capture fixture mode is invalid');
  });
});
