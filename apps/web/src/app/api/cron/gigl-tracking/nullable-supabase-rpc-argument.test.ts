import { describe, expect, it } from 'vitest';
import { nullableSupabaseRpcArgument } from './nullable-supabase-rpc-argument';

describe('nullableSupabaseRpcArgument', () => {
  it('preserves SQL null instead of inventing a timestamp or location', () => {
    expect(nullableSupabaseRpcArgument(null)).toBeNull();
    expect(nullableSupabaseRpcArgument('Lagos')).toBe('Lagos');
  });
});
