import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { handlePolicyExpired } from './webhook-policy-handlers';

describe('MyCover policy webhook handlers', () => {
  it('ignores policy.expired payloads without a policy identifier', async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;

    await handlePolicyExpired(supabase, {});

    expect(supabase.from).not.toHaveBeenCalled();
  });
});
