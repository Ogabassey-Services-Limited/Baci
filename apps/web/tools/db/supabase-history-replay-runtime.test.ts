import { describe, expect, it } from 'vitest';
import { createSupabaseHistoryReplayRuntimeDependencies } from './supabase-history-replay-runtime';

describe('createSupabaseHistoryReplayRuntimeDependencies', () => {
  it('provides the bounded effect and production-old proof verifiers', () => {
    const runtime = createSupabaseHistoryReplayRuntimeDependencies();

    expect(runtime.verifyEffects).toBeTypeOf('function');
    expect(runtime.verifyProductionOldCancellation).toBeTypeOf('function');
    expect(runtime.readEffects).toBeTypeOf('function');
  });
});
