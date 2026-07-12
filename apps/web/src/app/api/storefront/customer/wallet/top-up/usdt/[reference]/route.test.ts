import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createAdmin: vi.fn(),
  enabled: true,
  extractAddress: vi.fn(),
  getPaymentSession: vi.fn(),
  rateLimit: vi.fn(),
  resolveCustomer: vi.fn(),
  resolveMerchant: vi.fn(),
}));

vi.mock('@/env', () => ({
  getRootDomain: () => 'usebaci.com',
  isUsdtWalletEnabled: () => mocks.enabled,
}));
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticate,
}));
vi.mock('@/lib/juicyway', () => ({
  extractCryptoAddress: mocks.extractAddress,
  getPaymentSession: mocks.getPaymentSession,
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.rateLimit,
  createRateLimitResponse: () => new Response('rate limited', { status: 429 }),
}));
vi.mock('@/lib/imei-lookup-fulfillment', () => ({
  resolveImeiCustomer: mocks.resolveCustomer,
}));
vi.mock('@/lib/storefront-merchant', () => ({
  resolveStorefrontMerchantFromRequest: mocks.resolveMerchant,
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdmin,
}));

import { GET } from './route';

const REFERENCE = 'wusdt_m123_1a2b3c';
const request = new Request('https://ogabassey.usebaci.com/api/wallet/usdt');
const context = (reference = REFERENCE) => ({
  params: Promise.resolve({ reference }),
});

function admin(row: Record<string, unknown> | null) {
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  const builder = {
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    select: vi.fn(() => builder),
  };
  return { from: vi.fn(() => builder), rpc };
}

describe('GET /api/storefront/customer/wallet/top-up/usdt/[reference]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled = true;
    mocks.rateLimit.mockResolvedValue({ allowed: true });
    mocks.extractAddress.mockReturnValue(null);
    mocks.getPaymentSession.mockResolvedValue({
      data: { payment: { payment_method: {}, status: 'pending' } },
      success: true,
    });
    mocks.authenticate.mockResolvedValue({
      supabase: {},
      user: { id: 'user-1' },
    });
    mocks.resolveMerchant.mockResolvedValue({
      merchant: { id: 'merchant-1' },
      success: true,
    });
    mocks.resolveCustomer.mockResolvedValue({ id: 'customer-1' });
    mocks.createAdmin.mockReturnValue(
      admin({
        amount: 65,
        currency: 'USDT',
        gateway_response: {
          address: { address: 'TVaultAddress', chain: 'TRX' },
        },
        id: 'transaction-1',
        metadata: {
          customer_id: 'customer-1',
          transaction_type: 'wallet_usdt_topup',
        },
        status: 'pending',
        updated_at: '2026-07-11T12:00:00.000Z',
      })
    );
  });

  it('authenticates before resolving a funding reference', async () => {
    mocks.authenticate.mockResolvedValue({ error: 'Unauthorized' });

    const response = await GET(request as unknown as NextRequest, context());

    expect(response.status).toBe(401);
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it('returns a customer-owned deposit status and address', async () => {
    const response = await GET(request as never, context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      amount: 65,
      currency: 'USDT',
      depositAddress: 'TVaultAddress',
      fundingStatus: 'pending',
      reference: REFERENCE,
      success: true,
    });
  });

  it('refreshes and persists a delayed Juicyway deposit address', async () => {
    const database = admin({
      amount: 65,
      currency: 'USDT',
      gateway_response: { address: null, session_id: 'session-1' },
      id: 'transaction-1',
      metadata: {
        customer_id: 'customer-1',
        juicyway_session_id: '11111111-1111-4111-8111-111111111111',
        transaction_type: 'wallet_usdt_topup',
      },
      status: 'pending',
      updated_at: '2026-07-11T12:00:00.000Z',
    });
    mocks.createAdmin.mockReturnValue(database);
    mocks.getPaymentSession.mockResolvedValue({
      data: {
        payment: { payment_method: {}, status: 'pending' },
      },
      success: true,
    });
    mocks.extractAddress.mockReturnValue({
      address: 'TLateAddress',
      chain: 'TRX',
      currency: 'USDT',
    });

    const response = await GET(request as never, context());

    await expect(response.json()).resolves.toMatchObject({
      depositAddress: 'TLateAddress',
    });
    expect(mocks.getPaymentSession).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(database.rpc).toHaveBeenCalledWith(
      'record_juicyway_usdt_deposit_address',
      {
        p_address: expect.objectContaining({ address: 'TLateAddress' }),
        p_provider_status: 'pending',
        p_session_id: '11111111-1111-4111-8111-111111111111',
        p_transaction_id: 'transaction-1',
      }
    );
  });

  it('keeps returning pending when Juicyway address refresh throws', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mocks.createAdmin.mockReturnValue(
      admin({
        amount: 65,
        currency: 'USDT',
        gateway_response: { address: null },
        id: 'transaction-1',
        metadata: {
          customer_id: 'customer-1',
          juicyway_session_id: '11111111-1111-4111-8111-111111111111',
          transaction_type: 'wallet_usdt_topup',
        },
        status: 'pending',
        updated_at: '2026-07-11T12:00:00.000Z',
      })
    );
    mocks.getPaymentSession.mockRejectedValue(new Error('provider offline'));

    const response = await GET(request as unknown as NextRequest, context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      depositAddress: null,
      fundingStatus: 'pending',
      success: true,
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[USDT Wallet] Deposit address refresh failed',
      expect.objectContaining({ reference: REFERENCE })
    );
    consoleError.mockRestore();
  });

  it('rate-limits authenticated funding-status polling before database reads', async () => {
    mocks.rateLimit.mockResolvedValue({
      allowed: false,
      limit: 100,
      remaining: 0,
      resetTime: Date.now() + 60_000,
    });

    const response = await GET(request as never, context());

    expect(response.status).toBe(429);
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it('does not reveal a reference owned by another customer', async () => {
    mocks.createAdmin.mockReturnValue(
      admin({
        metadata: {
          customer_id: 'customer-2',
          transaction_type: 'wallet_usdt_topup',
        },
      })
    );

    const response = await GET(request as never, context());

    expect(response.status).toBe(404);
  });
});
