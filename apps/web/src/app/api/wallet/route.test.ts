import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkCsrfProtection: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchantForApiRequest,
}));

function createMerchantWalletSelect(data: unknown, error: unknown = null) {
  return {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
}

function createPendingSettlementsQuery(data: unknown[] = []) {
  return {
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error: null }),
    order: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
  };
}

function createMerchantWalletUpdate(error: unknown = null) {
  return {
    eq: vi.fn().mockResolvedValue({ error }),
  };
}

let walletSettingsResult: unknown = {
  auto_payout_enabled: true,
  auto_payout_day: 'monday',
  min_payout_amount: 1000,
  last_payout_at: null,
  last_payout_amount: null,
};
let walletSelectError: unknown = null;
let pendingSettlements: unknown[] = [];
let updateError: unknown = null;

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mocks.getUser },
    from: vi.fn((table: string) => {
      if (table === 'merchant_settlements') {
        return createPendingSettlementsQuery(pendingSettlements);
      }

      if (table === 'merchant_wallets') {
        return {
          select: vi.fn(() =>
            createMerchantWalletSelect(walletSettingsResult, walletSelectError)
          ),
          update: vi.fn(() => createMerchantWalletUpdate(updateError)),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: mocks.rpc,
  })),
}));

function patchRequest(body: unknown) {
  return new NextRequest('https://usebaci.com/api/wallet', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('/api/wallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkCsrfProtection.mockResolvedValue({
      valid: true,
      response: null,
    });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.getMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
    });
    mocks.rpc.mockReset();
    walletSettingsResult = {
      auto_payout_enabled: true,
      auto_payout_day: 'monday',
      min_payout_amount: 1000,
      last_payout_at: null,
      last_payout_amount: null,
    };
    walletSelectError = null;
    pendingSettlements = [];
    updateError = null;
  });

  it('returns 401 when the user is missing', async () => {
    const { GET } = await import('./route');
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 404 when merchant resolution fails', async () => {
    const { GET } = await import('./route');
    mocks.getMerchantForApiRequest.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Merchant not found',
    });
  });

  it('returns 500 when wallet initialization fails', async () => {
    const { GET } = await import('./route');
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'create failed' },
    });

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to initialize wallet',
    });
  });

  it('falls back to direct wallet data when summary RPC is unavailable', async () => {
    const { GET } = await import('./route');
    mocks.rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'missing fn' },
      });
    walletSettingsResult = {
      id: 'wallet-1',
      available_balance: 1500,
      pending_balance: 250,
      upcoming_balance: 300,
      upcoming_count: 2,
      total_earned: 5000,
      total_withdrawn: 1000,
      auto_payout_enabled: false,
      auto_payout_day: 'friday',
      min_payout_amount: 2000,
      last_payout_at: null,
      last_payout_amount: null,
    };

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.wallet).toMatchObject({
      id: 'wallet-1',
      availableBalance: 1500,
      canWithdraw: true,
      autoPayoutEnabled: false,
    });
  });

  it('returns wallet summary and pending settlements on success', async () => {
    const { GET } = await import('./route');
    mocks.rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: [
          {
            wallet_id: 'wallet-1',
            available_balance: 1000,
            pending_balance: 50,
            upcoming_balance: 75,
            upcoming_count: 1,
            total_earned: 2500,
            total_withdrawn: 500,
            can_withdraw: true,
            next_settlement_date: '2026-07-04',
            next_settlement_amount: 75,
          },
        ],
        error: null,
      });
    pendingSettlements = [
      {
        id: 'settlement-1',
        net_amount: 75,
        gateway: 'paystack',
        source_type: 'order',
        expected_settlement_date: '2026-07-04',
        description: 'Order settlement',
      },
    ];

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.wallet).toMatchObject({
      id: 'wallet-1',
      availableBalance: 1000,
      nextSettlementAmount: 75,
    });
    expect(body.pendingSettlements).toEqual([
      expect.objectContaining({ amount: 75, gateway: 'paystack' }),
    ]);
  });
  it('returns 403 when CSRF validation fails', async () => {
    const { PATCH } = await import('./route');
    mocks.checkCsrfProtection.mockResolvedValueOnce({
      valid: false,
      response: undefined,
    });

    const response = await PATCH(patchRequest({ autoPayoutEnabled: false }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'CSRF validation failed',
    });
  });

  it('returns 400 for invalid JSON', async () => {
    const { PATCH } = await import('./route');

    const response = await PATCH(patchRequest('{'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid JSON body',
    });
  });

  it('returns 400 for an empty update payload', async () => {
    const { PATCH } = await import('./route');

    const response = await PATCH(patchRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'No valid updates provided',
    });
  });

  it('returns 500 when the wallet update fails', async () => {
    const { PATCH } = await import('./route');
    updateError = { message: 'update failed' };

    const response = await PATCH(patchRequest({ autoPayoutEnabled: false }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to update settings',
    });
  });

  it('updates wallet settings on success', async () => {
    const { PATCH } = await import('./route');

    const response = await PATCH(
      patchRequest({ autoPayoutEnabled: false, autoPayoutDay: 'friday' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: 'Wallet settings updated',
    });
  });
});
