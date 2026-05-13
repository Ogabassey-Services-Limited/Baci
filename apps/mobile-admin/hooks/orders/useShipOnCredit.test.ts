import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getSession: vi.fn(),
  invalidateQueries: vi.fn(),
  merchantId: 'merchant-1',
}));

vi.stubGlobal('fetch', mocks.fetch);

vi.mock('@/lib/api-client', () => ({
  BASE_URL: 'https://example.test',
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

vi.mock('../useMerchant', () => ({
  useMerchant: () => ({
    merchant: mocks.merchantId ? { id: mocks.merchantId } : null,
  }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query'
  );

  return {
    ...actual,
    useMutation: vi.fn((config) => config),
    useQueryClient: () => ({
      invalidateQueries: mocks.invalidateQueries,
    }),
  };
});

import { useShipOnCredit } from './useShipOnCredit';

describe('useShipOnCredit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.merchantId = 'merchant-1';
    mocks.getSession.mockResolvedValue({ data: { session: null } });
  });

  it('throws when ship-on-credit runs without a session token', async () => {
    const mutation = useShipOnCredit() as unknown as {
      mutationFn: (vars: {
        creditNotes?: string;
        orderId: string;
      }) => Promise<unknown>;
    };

    await expect(
      mutation.mutationFn({ orderId: 'order-1', creditNotes: 'Later' })
    ).rejects.toThrow('Not authenticated');

    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('throws auth session errors before posting ship-on-credit requests', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
      error: { message: 'Session lookup failed' },
    });

    const mutation = useShipOnCredit() as unknown as {
      mutationFn: (vars: { orderId: string }) => Promise<unknown>;
    };

    await expect(mutation.mutationFn({ orderId: 'order-1' })).rejects.toThrow(
      'Session lookup failed'
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('posts credit notes and invalidates scoped order caches on success', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    mocks.fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ success: true }),
    });

    const mutation = useShipOnCredit() as unknown as {
      mutationFn: (vars: {
        creditNotes?: string;
        orderId: string;
      }) => Promise<unknown>;
      onSuccess: (_data: unknown, vars: { orderId: string }) => void;
    };

    await expect(
      mutation.mutationFn({ orderId: 'order-1', creditNotes: 'Later' })
    ).resolves.toEqual({ success: true });
    mutation.onSuccess(null, { orderId: 'order-1' });

    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://example.test/api/orders/order-1/ship-on-credit',
      expect.objectContaining({
        body: JSON.stringify({ credit_notes: 'Later' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer token-1',
        }),
        method: 'POST',
      })
    );
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['order', 'order-1'],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['orders', 'merchant-1'],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['order-counts', 'merchant-1'],
    });
  });

  it('surfaces a timeout error when ship-on-credit hangs', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';

    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    mocks.fetch.mockRejectedValue(abortError);

    const mutation = useShipOnCredit() as unknown as {
      mutationFn: (vars: { orderId: string }) => Promise<unknown>;
    };

    await expect(mutation.mutationFn({ orderId: 'order-1' })).rejects.toThrow(
      'Request timed out. Please check your connection and try again.'
    );
  });

  it('skips merchant-scoped invalidations when the merchant is unavailable', () => {
    mocks.merchantId = '';

    const mutation = useShipOnCredit() as unknown as {
      onSuccess: (_data: unknown, vars: { orderId: string }) => void;
    };

    mutation.onSuccess(null, { orderId: 'order-1' });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['order', 'order-1'],
    });
    expect(mocks.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ['orders', 'merchant-1'],
    });
    expect(mocks.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ['order-counts', 'merchant-1'],
    });
  });
});
