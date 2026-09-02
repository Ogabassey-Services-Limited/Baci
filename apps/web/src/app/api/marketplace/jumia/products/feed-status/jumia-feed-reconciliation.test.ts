import { describe, expect, it, vi } from 'vitest';
import { jumiaFeedReconciliation } from './jumia-feed-reconciliation';

describe('jumiaFeedReconciliation', () => {
  it('uses the sole null-SKU mapping only for a single feed item', () => {
    const mapping = {
      id: 'mapping-1',
      last_feed_id: 'feed-1',
      jumia_seller_sku: null,
      last_synced_at: null,
    };

    expect(
      jumiaFeedReconciliation.findMappingForFeedItem([mapping], 'SKU-1', 1)
    ).toBe(mapping);
    expect(
      jumiaFeedReconciliation.findMappingForFeedItem([mapping], 'SKU-1', 2)
    ).toBeUndefined();
  });

  it('fails when a rejected mapping cannot be persisted', async () => {
    const builder = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    builder.update.mockReturnValue(builder);
    builder.eq.mockReturnValueOnce(builder).mockResolvedValueOnce({
      error: { message: 'write failed' },
    });
    const supabase = { from: vi.fn(() => builder) };

    await expect(
      jumiaFeedReconciliation.markMappingsAsFeedError(
        supabase as never,
        'merchant-1',
        [
          {
            id: 'mapping-1',
            last_feed_id: 'feed-1',
            jumia_seller_sku: 'SKU-1',
            last_synced_at: null,
          },
        ],
        'Rejected'
      )
    ).rejects.toThrow('Failed to mark rejected Jumia feed mapping');
  });

  it('keeps unmatched terminal-feed mappings pending for manual resolution', async () => {
    const update = vi.fn();
    const builder = {
      update,
      eq: vi.fn(),
    };
    builder.update.mockReturnValue(builder);
    builder.eq.mockReturnValueOnce(builder).mockResolvedValueOnce({
      error: null,
    });
    const supabase = { from: vi.fn(() => builder) };

    await expect(
      jumiaFeedReconciliation.markMappingsAsPendingForManualResolution(
        supabase as never,
        'merchant-1',
        [
          {
            id: 'mapping-1',
            last_feed_id: 'feed-1',
            jumia_seller_sku: 'SKU-1',
            last_synced_at: null,
          },
        ],
        'manual resolution required'
      )
    ).resolves.toBe(1);
    expect(update).toHaveBeenCalledWith({
      sync_status: 'pending',
      sync_error: 'manual resolution required',
      last_feed_id: null,
      last_synced_at: expect.any(String),
    });
  });
});
