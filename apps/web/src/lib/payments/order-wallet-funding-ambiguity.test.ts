import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fileAmbiguousReview } from '@/lib/payments/order-wallet-funding-ambiguity';

const mocks = vi.hoisted(() => ({
  loggerError: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

function asSupabaseClient(client: unknown) {
  return client as SupabaseClient;
}

describe('fileAmbiguousReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('files ambiguous reviews through the atomic RPC', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const supabase = { rpc };

    await fileAmbiguousReview({
      gatewayReference: 'gateway-ref',
      intentIds: ['intent-1', 'intent-2'],
      supabase: asSupabaseClient(supabase),
    });

    expect(rpc).toHaveBeenCalledWith(
      'file_wallet_order_funding_ambiguous_review',
      {
        p_gateway_reference: 'gateway-ref',
        p_intent_ids: ['intent-1', 'intent-2'],
      }
    );
  });

  it('logs and throws when the ambiguity RPC fails', async () => {
    const error = new Error('rpc failed');
    const supabase = { rpc: vi.fn(async () => ({ data: null, error })) };

    await expect(
      fileAmbiguousReview({
        gatewayReference: 'gateway-ref',
        intentIds: ['intent-1'],
        supabase: asSupabaseClient(supabase),
      })
    ).rejects.toThrow(error);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        message: 'Failed to file wallet-funded order ambiguity review',
      })
    );
  });

  it('rejects invalid inputs before marking or inserting review rows', async () => {
    const supabase = { rpc: vi.fn(async () => ({ data: null, error: null })) };

    await expect(
      fileAmbiguousReview({
        gatewayReference: '',
        intentIds: [],
        supabase: asSupabaseClient(supabase),
      })
    ).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
