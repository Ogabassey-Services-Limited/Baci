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

import { useGenerateDva } from './useGenerateDva';

describe('useGenerateDva', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: null } });
  });

  it('throws when DVA generation runs without a session token', async () => {
    const mutation = useGenerateDva() as unknown as {
      mutationFn: (vars: { orderId: string }) => Promise<unknown>;
    };

    await expect(mutation.mutationFn({ orderId: 'order-1' })).rejects.toThrow(
      'Not authenticated'
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('throws auth session errors before posting DVA generation requests', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
      error: { message: 'Session lookup failed' },
    });

    const mutation = useGenerateDva() as unknown as {
      mutationFn: (vars: { orderId: string }) => Promise<unknown>;
    };

    await expect(mutation.mutationFn({ orderId: 'order-1' })).rejects.toThrow(
      'Session lookup failed'
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('posts DVA generation requests and invalidates order detail on success', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        existing: false,
        success: true,
        virtualAccount: {
          account_name: 'Baci Store',
          account_number: '1234567890',
          bank_name: 'Paystack-Titan',
        },
      }),
    });

    const mutation = useGenerateDva() as unknown as {
      mutationFn: (vars: { orderId: string }) => Promise<unknown>;
      onSuccess: (_data: unknown, vars: { orderId: string }) => void;
    };

    await expect(mutation.mutationFn({ orderId: 'order-1' })).resolves.toEqual({
      existing: false,
      success: true,
      virtualAccount: {
        account_name: 'Baci Store',
        account_number: '1234567890',
        bank_name: 'Paystack-Titan',
      },
    });
    mutation.onSuccess(null, { orderId: 'order-1' });

    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://example.test/api/orders/order-1/generate-dva',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-1',
        }),
        method: 'POST',
      })
    );
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['order', 'order-1'],
    });
  });

  it('uses API error messages when DVA generation fails', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    mocks.fetch.mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({ error: 'Already has a virtual account' }),
    });

    const mutation = useGenerateDva() as unknown as {
      mutationFn: (vars: { orderId: string }) => Promise<unknown>;
    };

    await expect(mutation.mutationFn({ orderId: 'order-1' })).rejects.toThrow(
      'Already has a virtual account'
    );
  });
});
