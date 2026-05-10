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

import { useSendReminder } from './useSendReminder';

describe('useSendReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: null } });
  });

  it('throws when reminder runs without a session token', async () => {
    const mutation = useSendReminder() as unknown as {
      mutationFn: (vars: {
        channel?: 'email' | 'sms' | 'whatsapp';
        message?: string;
        orderId: string;
      }) => Promise<unknown>;
    };

    await expect(
      mutation.mutationFn({ orderId: 'order-1', channel: 'email' })
    ).rejects.toThrow('Not authenticated');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('posts reminder payloads and invalidates the order detail cache', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sent: true }),
    });

    const mutation = useSendReminder() as unknown as {
      mutationFn: (vars: {
        channel?: 'email' | 'sms' | 'whatsapp';
        message?: string;
        orderId: string;
      }) => Promise<unknown>;
      onSuccess: (_data: unknown, vars: { orderId: string }) => void;
    };

    await expect(
      mutation.mutationFn({
        orderId: 'order-1',
        channel: 'whatsapp',
        message: 'Pay soon',
      })
    ).resolves.toEqual({ sent: true });
    mutation.onSuccess(null, { orderId: 'order-1' });

    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://example.test/api/orders/order-1/reminder',
      expect.objectContaining({
        body: JSON.stringify({ channel: 'whatsapp', message: 'Pay soon' }),
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

  it('propagates structured reminder API error messages', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    mocks.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ error: 'provider down' }),
    });

    const mutation = useSendReminder() as unknown as {
      mutationFn: (vars: { orderId: string }) => Promise<unknown>;
    };

    await expect(mutation.mutationFn({ orderId: 'order-1' })).rejects.toThrow(
      'provider down'
    );
  });

  it('uses the fallback message when reminder API errors are not JSON', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    mocks.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => {
        throw new Error('not-json');
      },
    });

    const mutation = useSendReminder() as unknown as {
      mutationFn: (vars: { orderId: string }) => Promise<unknown>;
    };

    await expect(mutation.mutationFn({ orderId: 'order-1' })).rejects.toThrow(
      'Request failed: 503 Service Unavailable'
    );
  });
});
