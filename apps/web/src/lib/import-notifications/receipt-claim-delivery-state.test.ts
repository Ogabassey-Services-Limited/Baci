import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  deleteReceiptClaim,
  markReceiptClaimNotificationSent,
} from '@/lib/import-notifications/receipt-claim-delivery-state';

function createReceiptClaimsTableMock(response: { error: Error | null }) {
  const query = {
    delete: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
  };
  query.delete.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.eq.mockResolvedValue(response);

  return {
    from: vi.fn(() => query),
    query,
  } as unknown as SupabaseClient & { query: typeof query };
}

describe('receipt claim delivery state', () => {
  it('deletes receipt claims by id', async () => {
    const supabase = createReceiptClaimsTableMock({ error: null });

    await deleteReceiptClaim({ claimId: 'claim-1', supabase });

    expect(supabase.from).toHaveBeenCalledWith('receipt_claims');
    expect(supabase.query.delete).toHaveBeenCalled();
    expect(supabase.query.eq).toHaveBeenCalledWith('id', 'claim-1');
  });

  it('marks receipt claims as notification sent', async () => {
    const supabase = createReceiptClaimsTableMock({ error: null });

    await markReceiptClaimNotificationSent({
      claimId: 'claim-1',
      supabase,
    });

    expect(supabase.query.update).toHaveBeenCalledWith({
      notification_sent_at: expect.any(String),
    });
    expect(supabase.query.eq).toHaveBeenCalledWith('id', 'claim-1');
  });

  it('surfaces Supabase mutation failures', async () => {
    const supabase = createReceiptClaimsTableMock({
      error: new Error('permission denied'),
    });

    await expect(
      deleteReceiptClaim({ claimId: 'claim-1', supabase })
    ).rejects.toThrow('Failed to delete unsent receipt claim');
  });

  it('surfaces notification-sent update failures', async () => {
    const supabase = createReceiptClaimsTableMock({
      error: new Error('permission denied'),
    });

    await expect(
      markReceiptClaimNotificationSent({
        claimId: 'claim-1',
        supabase,
      })
    ).rejects.toThrow('Failed to mark receipt claim notification sent');
  });
});
