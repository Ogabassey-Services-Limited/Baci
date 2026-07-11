import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getSession: vi.fn(),
  invalidateQueries: vi.fn(),
  storageValues: new Map<string, string>(),
}));

vi.stubGlobal('fetch', mocks.fetch);

vi.mock('@/lib/api-client', () => ({
  BASE_URL: 'https://example.test',
}));

vi.mock('@/utils/uuid', () => ({
  generateUUID: vi.fn(() => '11111111-1111-4111-8111-111111111111'),
}));

vi.mock('@/lib/storage', () => ({
  asyncStorage: {
    getItem: vi.fn((key: string) =>
      Promise.resolve(mocks.storageValues.get(key) ?? null)
    ),
    removeItem: vi.fn((key: string) => {
      mocks.storageValues.delete(key);
      return Promise.resolve();
    }),
    setItem: vi.fn((key: string, value: string) => {
      mocks.storageValues.set(key, value);
      return Promise.resolve();
    }),
  },
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useRef: <T>(initialValue: T) => ({ current: initialValue }),
  };
});

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

import { asyncStorage as AsyncStorage } from '@/lib/storage';
import { generateUUID } from '@/utils/uuid';
import { useRecordPayment } from './useRecordPayment';

describe('useRecordPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageValues.clear();
    vi.mocked(generateUUID).mockReturnValue(
      '11111111-1111-4111-8111-111111111111'
    );
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
          idempotency_key: '11111111-1111-4111-8111-111111111111',
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

  it('reuses the same idempotency key after a timed-out attempt', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    mocks.fetch.mockRejectedValueOnce(abortError).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recorded: true }),
    });

    const mutation = useRecordPayment() as unknown as {
      mutationFn: (vars: {
        amount: number;
        orderId: string;
        paymentMethod: string;
      }) => Promise<unknown>;
    };
    const input = {
      amount: 5000,
      orderId: 'order-1',
      paymentMethod: 'cash',
    };

    await expect(mutation.mutationFn(input)).rejects.toThrow(
      'Request timed out. Please check your connection and try again.'
    );
    await expect(mutation.mutationFn(input)).resolves.toEqual({
      recorded: true,
    });

    const requestBodies = mocks.fetch.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body))
    );
    expect(requestBodies[0].idempotency_key).toBe(
      requestBodies[1].idempotency_key
    );
    expect(generateUUID).toHaveBeenCalledTimes(1);
  });

  it('reuses the pending idempotency key when only notes change', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    mocks.fetch.mockRejectedValueOnce(abortError).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recorded: true }),
    });
    const mutation = useRecordPayment() as unknown as {
      mutationFn: (vars: {
        amount: number;
        notes?: string;
        orderId: string;
        paymentMethod: string;
      }) => Promise<unknown>;
    };

    await expect(
      mutation.mutationFn({
        amount: 5000,
        notes: 'first note',
        orderId: 'order-1',
        paymentMethod: 'cash',
      })
    ).rejects.toThrow(
      'Request timed out. Please check your connection and try again.'
    );
    await mutation.mutationFn({
      amount: 5000,
      notes: 'updated note',
      orderId: 'order-1',
      paymentMethod: 'cash',
    });

    const requestBodies = mocks.fetch.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body))
    );
    expect(requestBodies[0].idempotency_key).toBe(
      requestBodies[1].idempotency_key
    );
    expect(generateUUID).toHaveBeenCalledTimes(1);
  });

  it('reuses the pending idempotency key when only payment method changes', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    mocks.fetch.mockRejectedValueOnce(abortError).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recorded: true }),
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
        amount: 5000,
        orderId: 'order-1',
        paymentMethod: 'cash',
      })
    ).rejects.toThrow(
      'Request timed out. Please check your connection and try again.'
    );
    await mutation.mutationFn({
      amount: 5000,
      orderId: 'order-1',
      paymentMethod: 'bank_transfer',
    });

    const requestBodies = mocks.fetch.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body))
    );
    expect(requestBodies[0].payment_method).toBe('cash');
    expect(requestBodies[1].payment_method).toBe('bank_transfer');
    expect(requestBodies[0].idempotency_key).toBe(
      requestBodies[1].idempotency_key
    );
    expect(generateUUID).toHaveBeenCalledTimes(1);
  });

  it('reuses the pending idempotency key when a reference is added', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    mocks.fetch.mockRejectedValueOnce(abortError).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recorded: true }),
    });
    const mutation = useRecordPayment() as unknown as {
      mutationFn: (vars: {
        amount: number;
        orderId: string;
        paymentMethod: string;
        reference?: string;
      }) => Promise<unknown>;
    };

    await expect(
      mutation.mutationFn({
        amount: 5000,
        orderId: 'order-1',
        paymentMethod: 'cash',
      })
    ).rejects.toThrow(
      'Request timed out. Please check your connection and try again.'
    );
    await mutation.mutationFn({
      amount: 5000,
      orderId: 'order-1',
      paymentMethod: 'cash',
      reference: 'POS-123',
    });

    const requestBodies = mocks.fetch.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body))
    );
    expect(requestBodies[0].reference).toBeUndefined();
    expect(requestBodies[1].reference).toBe('POS-123');
    expect(requestBodies[0].idempotency_key).toBe(
      requestBodies[1].idempotency_key
    );
    expect(generateUUID).toHaveBeenCalledTimes(1);
  });

  it('reuses a persisted idempotency key after the hook remounts', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    mocks.fetch.mockRejectedValueOnce(abortError).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recorded: true }),
    });
    const input = {
      amount: 5000,
      orderId: 'order-1',
      paymentMethod: 'cash',
    };
    const firstMount = useRecordPayment() as unknown as {
      mutationFn: (vars: typeof input) => Promise<unknown>;
    };

    await expect(firstMount.mutationFn(input)).rejects.toThrow(
      'Request timed out. Please check your connection and try again.'
    );

    const secondMount = useRecordPayment() as unknown as {
      mutationFn: (vars: typeof input) => Promise<unknown>;
    };
    await expect(secondMount.mutationFn(input)).resolves.toEqual({
      recorded: true,
    });

    const requestBodies = mocks.fetch.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body))
    );
    expect(requestBodies[0].idempotency_key).toBe(
      requestBodies[1].idempotency_key
    );
    expect(generateUUID).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      expect.stringMatching(/^manual-payment-retry:order-1:/)
    );
  });

  it('surfaces every idempotent replay as a previous-payment reconciliation', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    mocks.fetch.mockRejectedValueOnce(abortError).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ idempotency_replayed: true, recorded: true }),
    });
    const input = {
      amount: 5000,
      orderId: 'order-1',
      paymentMethod: 'cash',
    };

    const firstMount = useRecordPayment() as unknown as {
      mutationFn: (vars: typeof input) => Promise<unknown>;
    };
    await expect(firstMount.mutationFn(input)).rejects.toThrow(
      'Request timed out. Please check your connection and try again.'
    );
    const secondMount = useRecordPayment() as unknown as {
      mutationFn: (vars: typeof input) => Promise<unknown>;
    };
    await expect(secondMount.mutationFn(input)).resolves.toMatchObject({
      idempotency_replayed: true,
      reconciled_previous_payment: true,
    });

    const requestBodies = mocks.fetch.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body))
    );
    expect(requestBodies[0].idempotency_key).toBe(
      requestBodies[1].idempotency_key
    );
    expect(generateUUID).toHaveBeenCalledTimes(1);
  });

  it('does not reuse a completed key when retry cleanup fails', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    vi.mocked(generateUUID)
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ recorded: true }),
    });
    vi.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(
      new Error('storage cleanup failed')
    );
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const input = {
      amount: 5000,
      orderId: 'order-1',
      paymentMethod: 'cash',
    };

    const firstMount = useRecordPayment() as unknown as {
      mutationFn: (vars: typeof input) => Promise<unknown>;
    };
    await expect(firstMount.mutationFn(input)).resolves.toEqual({
      recorded: true,
    });
    const secondMount = useRecordPayment() as unknown as {
      mutationFn: (vars: typeof input) => Promise<unknown>;
    };
    await expect(secondMount.mutationFn(input)).resolves.toEqual({
      recorded: true,
    });

    const requestBodies = mocks.fetch.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body))
    );
    expect(requestBodies[0].idempotency_key).not.toBe(
      requestBodies[1].idempotency_key
    );
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to clear manual payment retry key',
      expect.any(Error)
    );
    consoleError.mockRestore();
  });

  it('keeps retry keys for different payments on the same order separate', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    vi.mocked(generateUUID)
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
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
        amount: 5000,
        orderId: 'order-1',
        paymentMethod: 'cash',
      })
    ).rejects.toThrow('Request timed out');
    await expect(
      mutation.mutationFn({
        amount: 6000,
        orderId: 'order-1',
        paymentMethod: 'cash',
      })
    ).rejects.toThrow('Request timed out');

    const retryKeys = [...mocks.storageValues.keys()].filter((key) =>
      key.startsWith('manual-payment-retry:order-1:')
    );
    expect(retryKeys).toHaveLength(2);
    expect(new Set(mocks.storageValues.values()).size).toBe(2);
  });

  it('continues recording when persisted retry state cannot be read', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(
      new Error('storage unavailable')
    );
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ recorded: true }),
    });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const mutation = useRecordPayment() as unknown as {
      mutationFn: (vars: {
        amount: number;
        orderId: string;
        paymentMethod: string;
      }) => Promise<unknown>;
    };

    await expect(
      mutation.mutationFn({
        amount: 5000,
        orderId: 'order-1',
        paymentMethod: 'cash',
      })
    ).resolves.toEqual({ recorded: true });

    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to read manual payment retry key',
      expect.any(Error)
    );
    consoleError.mockRestore();
  });

  it('continues recording when the retry key cannot be persisted', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(
      new Error('storage full')
    );
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ recorded: true }),
    });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const mutation = useRecordPayment() as unknown as {
      mutationFn: (vars: {
        amount: number;
        orderId: string;
        paymentMethod: string;
      }) => Promise<unknown>;
    };

    await expect(
      mutation.mutationFn({
        amount: 5000,
        orderId: 'order-1',
        paymentMethod: 'cash',
      })
    ).resolves.toEqual({ recorded: true });

    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to persist manual payment retry key',
      expect.any(Error)
    );
    consoleError.mockRestore();
  });

  it('uses structured API error messages when manual payment fails', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    mocks.fetch.mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      text: async () => JSON.stringify({ error: 'Amount is invalid' }),
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
        amount: 0,
        paymentMethod: 'cash',
      })
    ).rejects.toThrow('Amount is invalid');
  });
});
