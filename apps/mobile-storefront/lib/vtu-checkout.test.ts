import {
  chargeSavedVtuCard,
  confirmVtuCheckout,
  initializeVtuCheckout,
  listSavedVtuCards,
} from '@/lib/vtu-checkout';

const mockFetchWithTimeout = jest.fn();
const mockGetUser = jest.fn();
const mockGetSession = jest.fn();

jest.mock('@/lib/fetch-with-timeout', () => ({
  DEFAULT_TIMEOUT: 30000,
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'token-123' } },
  });
});

describe('vtu-checkout service', () => {
  it('initializes VTU checkout with the authenticated token', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        authorization_url: 'https://paystack.com/pay/abc',
        gateway: 'paystack',
        reference: 'VTU-123',
        vtu_reference: 'REQ-123',
        vtu_transaction_id: 'vtu-1',
      }),
    });

    const result = await initializeVtuCheckout({
      amount: 1000,
      gateway: 'paystack',
      phoneNumber: '08012345678',
      networkProvider: 'mtn',
      type: 'airtime',
    });

    expect(result.reference).toBe('VTU-123');
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('/api/vtu/checkout/initialize'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      })
    );
  });

  it('confirms a successful VTU checkout', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        status: 'successful',
        reference: 'VTU-123',
        amount: 1000,
      }),
    });

    const result = await confirmVtuCheckout({
      gateway: 'paystack',
      reference: 'VTU-123',
    });

    expect(result.status).toBe('successful');
  });

  it('lists saved cards for the current storefront', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        cards: [
          {
            id: 'card-1',
            provider: 'paystack',
            label: 'Access Bank ending 1234',
            brand: 'visa',
            bank: 'Access Bank',
            last4: '1234',
            exp_month: '08',
            exp_year: '2030',
            is_default: true,
          },
        ],
      }),
    });

    const result = await listSavedVtuCards();

    expect(result[0]?.label).toBe('Access Bank ending 1234');
  });

  it('handles saved-card charges that require extra authorization', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        requires_authorization: true,
        authorization_url: 'https://paystack.com/pay/auth',
        gateway: 'paystack',
        reference: 'VTU-123',
      }),
    });

    const result = await chargeSavedVtuCard({
      amount: 1000,
      phoneNumber: '08012345678',
      networkProvider: 'mtn',
      savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'airtime',
    });

    expect(result).toMatchObject({
      authorization_url: 'https://paystack.com/pay/auth',
      requires_authorization: true,
    });
  });
});
