import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getSession: vi.fn(),
  invalidateQueries: vi.fn(),
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
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
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

import { useRecordPayment } from './useRecordPayment';

describe('useRecordPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: null } });
  });

  it('throws when record-payment runs without a session token', async () => {
    const mutation = useRecordPayment() as unknown as {
      mutationFn: (vars: {
        amount: number;
        orderId: string;
        paymentMethod: string;
      }) => Promise<unknown>;
    };

    await expect(
      mutation.mutationFn({
        orderId: 'order-1',
        amount: 5000,
        paymentMethod: 'cash',
      })
    ).rejects.toThrow('Not authenticated');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('throws auth session errors before posting manual payment details', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
      error: { message: 'Session lookup failed' },
    });

    const mutation = useRecordPayment() as unknown as {
      mutationFn: (vars: {
        amount: number;
        orderId: string;
        paymentMethod: string;
      }) => Promise<unknown>;
    };

    await expect(
      mutation.mutationFn({
        orderId: 'order-1',
        amount: 5000,
        paymentMethod: 'cash',
      })
    ).rejects.toThrow('Session lookup failed');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('posts manual payment details and invalidates dependent caches', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ recorded: true }),
    });

    const mutation = useRecordPayment() as unknown as {
      mutationFn: (vars: {
        amount: number;
        notes?: string;
        orderId: string;
        paymentMethod: string;
        reference?: string;
      }) => Promise<unknown>;
      onSuccess: (_data: unknown, vars: { orderId: string }) => void;
    };

    await expect(
      mutation.mutationFn({
        orderId: 'order-1',
        amount: 5000,
        paymentMethod: 'cash',
        reference: 'ref-1',
        notes: 'counter payment',
      })
    ).resolves.toEqual({ recorded: true });
    mutation.onSuccess(null, { orderId: 'order-1' });

    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://example.test/api/orders/order-1/record-payment',
      expect.objectContaining({
        body: JSON.stringify({
          amount: 5000,
          notes: 'counter payment',
          payment_method: 'cash',
          reference: 'ref-1',
        }),
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
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['dashboard-stats', 'merchant-1'],
    });
  });

  it('maps record-payment aborts to the user-facing timeout message', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });

    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    mocks.fetch.mockRejectedValue(abortError);

    const mutation = useRecordPayment() as unknown as {
      mutationFn: (vars: {
        amount: number;
        orderId: string;
        paymentMethod: string;
      }) => Promise<unknown>;
    };

    await expect(
      mutation.mutationFn({
        orderId: 'order-1',
        amount: 5000,
        paymentMethod: 'cash',
      })
    ).rejects.toThrow(
      'Request timed out. Please check your connection and try again.'
    );
  });
});
