import { describe, expect, it } from 'vitest';
import { supabaseHistoryEffectSnapshotSchema } from './schemas/supabase-history-effect-snapshot-schema';
import { createSupabaseHistoryEffectTestFixture } from './supabase-history-effect-test-fixture';
import { validateSupabaseHistoryEffectComponents } from './validate-supabase-history-effect-components';

describe('createSupabaseHistoryEffectTestFixture', () => {
  it('creates the exact safe 76-component v3 snapshot', () => {
    const fixture = createSupabaseHistoryEffectTestFixture();
    expect(supabaseHistoryEffectSnapshotSchema.parse(fixture)).toEqual(fixture);
    expect(
      validateSupabaseHistoryEffectComponents(fixture.components)
    ).toHaveLength(76);
  });

  it('applies one exact component override without weakening the scope', () => {
    const fixture = createSupabaseHistoryEffectTestFixture({
      overrides: [
        {
          category: 'producer-config',
          identity: 'commerce.orders',
          value: { enabled: true },
        },
      ],
    });
    expect(
      fixture.components.find(
        ({ category, identity }) =>
          category === 'producer-config' && identity === 'commerce.orders'
      )?.value
    ).toEqual({ enabled: true });
    expect(
      validateSupabaseHistoryEffectComponents(fixture.components)
    ).toHaveLength(76);
  });
});
