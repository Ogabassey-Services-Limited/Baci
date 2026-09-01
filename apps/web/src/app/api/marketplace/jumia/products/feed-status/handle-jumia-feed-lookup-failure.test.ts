import { beforeEach, describe, expect, it, vi } from 'vitest';

const { markMappingsAsFeedError } = vi.hoisted(() => ({
  markMappingsAsFeedError: vi.fn(),
}));
vi.mock('./jumia-feed-reconciliation', () => ({
  jumiaFeedReconciliation: { markMappingsAsFeedError },
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@/lib/jumia/client', () => ({
  JumiaApiError: class JumiaApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

import { JumiaApiError } from '@/lib/jumia/client';
import { handleJumiaFeedLookupFailure } from './handle-jumia-feed-lookup-failure';

describe('handleJumiaFeedLookupFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks a missing feed and lets the batch continue', async () => {
    markMappingsAsFeedError.mockResolvedValueOnce(2);

    const result = await handleJumiaFeedLookupFailure({
      error: new JumiaApiError(404, 'missing'),
      feedId: 'feed-1',
      mappingsForFeed: [
        {
          id: 'mapping-1',
          last_feed_id: 'feed-1',
          jumia_seller_sku: 'SKU-1',
          last_synced_at: null,
        },
      ],
      merchantId: 'merchant-1',
      supabase: {} as never,
    });

    expect(result).toEqual({
      kind: 'continue',
      failed: 2,
      status: 'NOT_FOUND',
      feedFailed: 1,
    });
    expect(markMappingsAsFeedError).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1',
      expect.any(Array),
      'Jumia product feed was not found'
    );
  });

  it('continues without marking mappings for retryable lookup failures', async () => {
    const result = await handleJumiaFeedLookupFailure({
      error: new Error('temporarily unavailable'),
      feedId: 'feed-1',
      mappingsForFeed: [],
      merchantId: 'merchant-1',
      supabase: {} as never,
    });

    expect(result).toEqual({
      kind: 'continue',
      failed: 0,
      status: 'ERROR',
      feedFailed: 0,
    });
    expect(markMappingsAsFeedError).not.toHaveBeenCalled();
  });
});
