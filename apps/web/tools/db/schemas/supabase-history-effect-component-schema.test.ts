import { describe, expect, it } from 'vitest';
import { supabaseHistoryEffectComponentSchema } from './supabase-history-effect-component-schema';

describe('supabaseHistoryEffectComponentSchema', () => {
  it('accepts a bounded category, identity, and JSON object value', () => {
    expect(
      supabaseHistoryEffectComponentSchema.parse({
        category: 'function',
        identity: 'public.example()',
        value: { owner: 'postgres', securityDefiner: true },
      })
    ).toEqual({
      category: 'function',
      identity: 'public.example()',
      value: { owner: 'postgres', securityDefiner: true },
    });
  });

  it('rejects unknown categories, empty identities, and non-object values', () => {
    for (const component of [
      { category: 'unknown', identity: 'public.example()', value: {} },
      { category: 'function', identity: '', value: {} },
      { category: 'function', identity: 'public.example()', value: [] },
      { category: 'function', identity: 'public.example()', value: 'raw' },
    ]) {
      expect(
        supabaseHistoryEffectComponentSchema.safeParse(component).success
      ).toBe(false);
    }
  });
});
