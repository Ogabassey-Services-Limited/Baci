import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  handleClaimUpdate,
  handleInspectionCompleted,
} from './webhook-claim-inspection-handlers';

describe('MyCover claim and inspection webhook handlers', () => {
  it('ignores post-loss inspection completions for policy activation state', async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;

    await handleInspectionCompleted(supabase, {
      meta: { category: 'postloss' },
    });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('ignores claim updates without an explicit policy identifier', async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;

    await handleClaimUpdate(supabase, {
      event: 'claim.updated',
      status: 'success',
      data: { id: 'claim-id', claim_status: 'approved' },
    });

    expect(supabase.from).not.toHaveBeenCalled();
  });
});
