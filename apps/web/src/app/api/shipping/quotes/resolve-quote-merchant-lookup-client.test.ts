import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveQuoteMerchantLookupClient } from './resolve-quote-merchant-lookup-client';

const mockCreateServerClient = vi.hoisted(() => vi.fn());
const mockCreateScopedClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateServerClient,
}));

vi.mock('@/lib/supabase/scoped', () => ({
  createScopedClient: mockCreateScopedClient,
}));

describe('resolveQuoteMerchantLookupClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateServerClient.mockResolvedValue({ from: vi.fn() });
  });

  it('falls back to the cookie client when the Bearer token is rejected', async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'JWT expired' },
        }),
      },
    };

    const client = await resolveQuoteMerchantLookupClient(
      {
        headers: {
          get: (name) =>
            name.toLowerCase() === 'authorization'
              ? 'Bearer stale-token'
              : null,
        },
      },
      supabase as never
    );

    expect(mockCreateServerClient).toHaveBeenCalled();
    expect(mockCreateScopedClient).not.toHaveBeenCalled();
    expect(client).toEqual(await mockCreateServerClient.mock.results[0]?.value);
  });
});
