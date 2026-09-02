import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const rpc = vi.fn();
  return { createAdminClient: vi.fn(() => ({ rpc })), rpc };
});

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { persistAdminGiglQuote } from './persist-admin-gigl-quote';

describe('persistAdminGiglQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: 'quote-1', error: null });
  });

  it('uses the admin client only for the trusted writer RPC', async () => {
    const quote = { id: 'quote-1', provider: 'GIGL' };
    const attestation = { quote_id: 'quote-1', order_id: 'order-1' };

    await expect(
      persistAdminGiglQuote({ quote, attestation })
    ).resolves.toMatchObject({ data: 'quote-1', error: null });

    expect(mocks.createAdminClient).toHaveBeenCalledWith();
    expect(mocks.rpc).toHaveBeenCalledWith('persist_admin_gigl_quote', {
      p_quote: quote,
      p_attestation: attestation,
    });
  });

  it('returns the trusted writer error without reshaping it', async () => {
    const error = { message: 'invalid_admin_quote' };
    mocks.rpc.mockResolvedValue({ data: null, error });

    await expect(
      persistAdminGiglQuote({ quote: {}, attestation: {} })
    ).resolves.toEqual({ data: null, error });
  });
});
