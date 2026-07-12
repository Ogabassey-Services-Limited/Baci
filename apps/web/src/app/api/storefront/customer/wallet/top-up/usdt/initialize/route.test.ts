import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  capture: vi.fn(),
  createAdminClient: vi.fn(),
  csrf: vi.fn(),
  enabled: true,
  initialize: vi.fn(),
  rateLimit: vi.fn(),
  resolveCustomer: vi.fn(),
  resolveMerchant: vi.fn(),
}));

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com', NODE_ENV: 'test' },
  isUsdtWalletEnabled: () => mocks.enabled,
}));
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticate,
}));
vi.mock('@/lib/csrf', () => ({ checkCsrfProtection: mocks.csrf }));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.rateLimit,
  createRateLimitResponse: () => new Response('rate limited', { status: 429 }),
}));
vi.mock('@/lib/resolve-wallet-top-up-merchant', () => ({
  resolveWalletTopUpMerchant: mocks.resolveMerchant,
}));
vi.mock('@/lib/vtu-pending-transaction', () => ({
  resolveVtuCustomer: mocks.resolveCustomer,
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock('@/lib/juicyway', () => ({
  capturePaymentWithCrypto: mocks.capture,
  extractCryptoAddress: (method: { address?: string }) =>
    method.address
      ? { address: method.address, chain: 'TRX', currency: 'USDT' }
      : null,
  generatePaymentReference: () => 'WUSDT-TEST',
  initializePayment: mocks.initialize,
  isJuicywayConfigured: () => true,
}));

import { POST } from './route';

let database: ReturnType<typeof adminClient>;

function adminClient() {
  const builder = {
    eq: vi.fn().mockResolvedValue({ error: null }),
    insert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue({
      data: { id: '11111111-1111-4111-8111-111111111111' },
      error: null,
    }),
    update: vi.fn(() => builder),
  };
  return { client: { from: vi.fn(() => builder) }, builder };
}

function request(amount = 25) {
  return new Request('https://ogabassey.usebaci.com/api/wallet/usdt', {
    body: JSON.stringify({
      amount,
      billingAddress: {
        city: 'Lagos',
        country: 'NG',
        line1: '1 Example Street',
        zipCode: '100001',
      },
      chain: 'TRX',
      merchantSlug: 'ogabassey',
    }),
    method: 'POST',
  });
}

describe('POST USDT wallet top-up initialize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled = true;
    mocks.authenticate.mockResolvedValue({
      user: { email: 'a@example.com', id: 'u1' },
    });
    mocks.csrf.mockResolvedValue({ valid: true });
    mocks.rateLimit.mockResolvedValue({ allowed: true });
    mocks.resolveMerchant.mockResolvedValue({
      business_name: 'OgaBassey',
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mocks.resolveCustomer.mockResolvedValue({
      email: 'a@example.com',
      first_name: 'Ada',
      id: 'customer-1',
      last_name: 'Lovelace',
      phone: '08012345678',
    });
    mocks.initialize.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
    });
    mocks.capture.mockResolvedValue({
      data: {
        payment: {
          amount: 2500,
          currency: 'USDT',
          id: '33333333-3333-4333-8333-333333333333',
          payment_method: { address: 'TExampleAddress' },
          status: 'pending',
        },
      },
      success: true,
    });
    database = adminClient();
    mocks.createAdminClient.mockReturnValue(database.client);
  });

  it('creates a direct USDT Juicyway session and returns the deposit address', async () => {
    const response = await POST(request() as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      amount: 25,
      chain: 'TRX',
      currency: 'USDT',
      depositAddress: 'TExampleAddress',
      reference: 'WUSDT-TEST',
      success: true,
    });
    expect(mocks.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2500, currency: 'USDT' })
    );
  });

  it('keeps the customer-approved amount locked when capture metadata drifts', async () => {
    mocks.capture.mockResolvedValue({
      data: {
        payment: {
          amount: 9999,
          currency: 'USDT',
          id: '33333333-3333-4333-8333-333333333333',
          payment_method: { address: 'TExampleAddress' },
          status: 'pending',
        },
      },
      success: true,
    });

    await POST(request() as never);

    expect(database.builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ juicyway_expected_amount: 2500 }),
      })
    );
  });

  it('locks wallet credit to the same cent-rounded amount sent to Juicyway', async () => {
    await POST(request(1.004) as never);

    expect(mocks.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100 })
    );
    expect(database.builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1,
        metadata: expect.objectContaining({ wallet_credit_amount: 1 }),
      })
    );
  });

  it('redirects back into the existing USDT wallet funding flow', async () => {
    await POST(request() as never);

    expect(mocks.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        redirect_url:
          'http://ogabassey.usebaci.com/wallet?fund-usdt=1&funding=WUSDT-TEST',
      })
    );
  });

  it('fails closed before creating a transaction while USDT wallets are dark', async () => {
    mocks.enabled = false;

    const response = await POST(request() as never);

    expect(response.status).toBe(404);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('rate-limits authenticated funding requests before creating a transaction', async () => {
    mocks.rateLimit.mockResolvedValue({
      allowed: false,
      limit: 10,
      remaining: 0,
      resetTime: Date.now() + 60_000,
    });

    const response = await POST(request() as never);

    expect(response.status).toBe(429);
    expect(mocks.csrf).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
