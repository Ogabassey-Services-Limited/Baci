import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateApiRequest = vi.fn();
const getUserAccess = vi.fn();
const hasPermission = vi.fn();
const checkCsrfProtection = vi.fn();
const createAdminClient = vi.fn();
const buildOrderGiglQuoteRequest = vi.fn();
const resolveBookingMerchantSender = vi.fn();
const getProviderQuotes = vi.fn();
const persistRpc = vi.fn();
const bindRpc = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
}));
vi.mock('@/lib/csrf', () => ({ checkCsrfProtection }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }));
vi.mock('@/lib/shipping/build-order-gigl-quote-request', () => ({
  buildOrderGiglQuoteRequest,
}));
vi.mock('@/lib/shipping/resolve-booking-merchant-sender', () => ({
  resolveBookingMerchantSender,
}));
vi.mock('@/lib/shipping', () => ({
  ShippingService: class MockShippingService {
    getProviderQuotes(...args: unknown[]) {
      return getProviderQuotes(...args);
    }
  },
}));

const orderId = '11111111-1111-4111-8111-111111111111';
const quoteId = '22222222-2222-4222-8222-222222222222';
const merchantId = '33333333-3333-4333-8333-333333333333';
const receiver = {
  phone: '08011112222',
  address: '5 Balogun Street',
  city: 'Ikeja',
  state: 'Lagos',
};
const sender = {
  name: 'Merchant Store',
  phone: '08012345678',
  address: '1 Merchant Road',
  city: 'Lagos',
  state: 'Lagos',
  country: 'Nigeria',
  countryCode: 'NG',
};
const builtRequest = {
  sessionId: orderId,
  sender,
  receiver,
  items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
  shipmentType: 'domestic' as const,
  deliveryPreference: 'door' as const,
};
const quote = {
  id: quoteId,
  provider: 'GIGL' as const,
  serviceTier: 'Standard',
  carrierName: 'GIG Logistics',
  displayName: 'Standard Delivery',
  estimatedDays: 2,
  price: 11_000,
  providerCost: 10_000,
  platformMargin: 1_000,
  marginBasisPoints: 1_000,
  pricingVersion: 'gigl_platform_margin_v1',
  currency: 'NGN' as const,
  pickupIncluded: true,
  insuranceIncluded: true,
  providerRateId: 'rate-1',
  expiresAt: new Date(Date.now() + 60_000),
  rawResponse: { secretProviderPayload: 'must-not-leak' },
  isStationPickup: false,
};

function request(body: unknown = {}, headers: Record<string, string> = {}) {
  return new NextRequest('https://usebaci.com/api/shipping/quotes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-baci-admin-order-mode': '1',
      'x-baci-admin-order-id': orderId,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function orderQuery(data: unknown = { id: orderId }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

function setup(overrides: { order?: unknown; orderError?: unknown } = {}) {
  const order = orderQuery(
    Object.hasOwn(overrides, 'order') ? overrides.order : { id: orderId }
  );
  if (overrides.orderError)
    order.maybeSingle.mockResolvedValue({
      data: null,
      error: overrides.orderError,
    });
  const admin = {
    from: vi.fn((table: string) => {
      if (table === 'orders') return order;
      throw new Error(`unexpected table ${table}`);
    }),
    rpc: persistRpc,
  };
  const supabase = { rpc: bindRpc };
  authenticateApiRequest.mockResolvedValue({
    user: { id: 'user-1' },
    supabase,
  });
  getUserAccess.mockResolvedValue({
    isOwner: true,
    merchantId,
    permissions: {},
  });
  hasPermission.mockReturnValue(true);
  checkCsrfProtection.mockResolvedValue({ valid: true });
  createAdminClient.mockReturnValue(admin);
  resolveBookingMerchantSender.mockResolvedValue({ ok: true, sender });
  buildOrderGiglQuoteRequest.mockResolvedValue({
    ok: true,
    request: builtRequest,
  });
  getProviderQuotes.mockResolvedValue([quote]);
  persistRpc.mockResolvedValue({ data: quoteId, error: null });
  bindRpc.mockResolvedValue({
    data: { available_balance: 20_000 },
    error: null,
  });
  return { admin, supabase, order };
}

async function subject(
  body: unknown = {},
  headers: Record<string, string> = {}
) {
  const { postAdminOrderGiglQuote } = await import('./admin-order-gigl-quote');
  return postAdminOrderGiglQuote(request(body, headers));
}

describe('postAdminOrderGiglQuote behavioral contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('authenticates before parsing malformed input or creating an admin client', async () => {
    const json = vi.fn().mockRejectedValue(new SyntaxError('malformed'));
    const unauthenticated = { headers: new Headers(), method: 'POST', json };
    authenticateApiRequest.mockResolvedValue({ user: null, supabase: null });
    const { postAdminOrderGiglQuote } = await import(
      './admin-order-gigl-quote'
    );
    const response = await postAdminOrderGiglQuote(unauthenticated as never);
    expect(response.status).toBe(401);
    expect(json).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('rejects failed CSRF before access checks and privileged client creation', async () => {
    checkCsrfProtection.mockResolvedValue({
      valid: false,
      response: new Response('csrf', { status: 403 }),
    });
    const response = await subject({ receiver });
    expect(response.status).toBe(403);
    expect(getUserAccess).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('rejects a non-owner', async () => {
    getUserAccess.mockResolvedValue({
      isOwner: false,
      merchantId,
      permissions: {},
    });
    const response = await subject({ receiver });
    expect(response.status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('rejects a caller without orders.fulfill permission', async () => {
    hasPermission.mockReturnValue(false);
    const response = await subject({ receiver });
    expect(response.status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('rejects missing merchant access', async () => {
    getUserAccess.mockResolvedValue(null);
    const response = await subject({ receiver });
    expect(response.status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('rejects an invalid receiver body after authorization', async () => {
    const response = await subject({ receiver: { city: 'Ikeja' } });
    expect(response.status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('rejects an invalid order id before creating a privileged client', async () => {
    const response = await subject(
      { receiver },
      { 'x-baci-admin-order-id': 'not-a-uuid' }
    );
    expect(response.status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('loads the order scoped to the authorized merchant', async () => {
    const { admin } = setup();
    const response = await subject({ receiver });
    expect(response.status).toBe(200);
    expect(admin.from).toHaveBeenCalledWith('orders');
    expect(admin.from('orders').eq).toHaveBeenCalledWith(
      'merchant_id',
      merchantId
    );
  });

  it('returns 404 when the order does not exist', async () => {
    setup({ order: null });
    const response = await subject({ receiver });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Order not found' });
  });

  it('returns 500 when the order lookup fails', async () => {
    setup({ orderError: { message: 'database unavailable' } });
    const response = await subject({ receiver });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to load order' });
  });

  it.each([
    ['shipment id', { id: orderId, shipment_id: 'shipment-1' }],
    ['tracking number', { id: orderId, tracking_number: 'TRK-1' }],
    ['booked status', { id: orderId, shipping_status: 'booked' }],
    ['shipped status', { id: orderId, shipping_status: 'shipped' }],
    ['in transit status', { id: orderId, shipping_status: 'in_transit' }],
  ])('rejects an order with %s already set', async (_label, order) => {
    setup({ order });
    const response = await subject({ receiver });
    expect(response.status).toBe(409);
    expect(getProviderQuotes).not.toHaveBeenCalled();
  });

  it('returns sender resolution failures without calling the provider', async () => {
    resolveBookingMerchantSender.mockResolvedValue({
      ok: false,
      error: 'Merchant details not found',
      status: 404,
    });
    const response = await subject({ receiver });
    expect(response.status).toBe(404);
    expect(getProviderQuotes).not.toHaveBeenCalled();
  });

  it('returns an incomplete sender configuration error', async () => {
    resolveBookingMerchantSender.mockResolvedValue({
      ok: false,
      error: 'Merchant shipping origin is not configured',
      status: 400,
    });
    const response = await subject({ receiver });
    expect(response.status).toBe(400);
    expect(getProviderQuotes).not.toHaveBeenCalled();
  });

  it.each([
    [
      'missing address',
      {
        ok: false,
        code: 'ORDER_SHIPPING_ADDRESS_INCOMPLETE',
        missing: ['address'],
        status: 422,
      },
    ],
    [
      'empty items',
      { ok: false, code: 'ORDER_SHIPPING_ITEMS_EMPTY', status: 400 },
    ],
    [
      'invalid item',
      { ok: false, code: 'ORDER_SHIPPING_ITEM_INVALID', status: 400 },
    ],
  ])('returns order build validation for %s', async (_label, result) => {
    buildOrderGiglQuoteRequest.mockResolvedValue(result);
    const response = await subject({ receiver });
    expect(response.status).toBe(result.status);
    expect(getProviderQuotes).not.toHaveBeenCalled();
    expect((await response.json()).code).toBe(result.code);
  });

  it('uses the authoritative order request and sender, with only a receiver override', async () => {
    const response = await subject({ receiver });
    expect(response.status).toBe(200);
    expect(buildOrderGiglQuoteRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: orderId }),
      sender,
      expect.any(Function),
      receiver
    );
  });

  it('maps provider transport failure to 503', async () => {
    getProviderQuotes.mockRejectedValue(new Error('GIGL timeout'));
    const response = await subject({ receiver });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'GIGL quote unavailable' });
  });

  it('rejects when no eligible GIGL door quote is returned', async () => {
    getProviderQuotes.mockResolvedValue([
      { ...quote, provider: 'TOPSHIP' },
      { ...quote, isStationPickup: true },
    ]);
    const response = await subject({ receiver });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'No eligible GIGL address-delivery quote',
    });
  });

  it('selects the cheapest eligible quote and persists full server economics and context', async () => {
    const cheaper = {
      ...quote,
      id: '44444444-4444-4444-8444-444444444444',
      price: 9_900,
    };
    getProviderQuotes.mockResolvedValue([{ ...quote, price: 12_000 }, cheaper]);
    const response = await subject({ receiver });
    expect(response.status).toBe(200);
    expect(persistRpc).toHaveBeenCalledWith(
      'persist_admin_gigl_quote',
      expect.objectContaining({
        p_quote: expect.objectContaining({
          id: cheaper.id,
          price: 9_900,
          provider_cost: cheaper.providerCost,
          platform_margin: cheaper.platformMargin,
          pricing_version: cheaper.pricingVersion,
          quote_request: expect.objectContaining({
            sessionId: orderId,
            admin_order_provenance: 'server_gigl_v1',
          }),
        }),
        p_attestation: expect.objectContaining({
          quote_id: cheaper.id,
          order_id: orderId,
          merchant_id: merchantId,
          provider_rate_id: cheaper.providerRateId,
          quote_request: expect.objectContaining({
            admin_order_provenance: 'server_gigl_v1',
          }),
        }),
      })
    );
  });

  it('maps trusted writer or attestation failure to a redacted 500', async () => {
    persistRpc.mockResolvedValue({
      data: null,
      error: { message: 'invalid_admin_quote' },
    });
    const response = await subject({ receiver });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to persist quote' });
    expect(bindRpc).not.toHaveBeenCalled();
  });

  it('binds by quote id only after the trusted writer succeeds', async () => {
    const response = await subject({ receiver });
    expect(response.status).toBe(200);
    expect(bindRpc).toHaveBeenCalledWith('bind_admin_gigl_quote', {
      p_order_id: orderId,
      p_merchant_id: merchantId,
      p_quote_id: quoteId,
      p_receiver: builtRequest.receiver,
    });
  });

  it('maps an already-transitioned order binding conflict to 409', async () => {
    bindRpc.mockResolvedValue({
      data: null,
      error: { message: 'order already shipped or booked' },
    });
    const response = await subject({ receiver });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'Order already shipped or booked',
    });
  });

  it('maps a non-conflict binder error to 500', async () => {
    bindRpc.mockResolvedValue({
      data: null,
      error: { message: 'invalid_quote_attestation' },
    });
    const response = await subject({ receiver });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to bind quote' });
  });

  it('returns wallet balance, exact shortfall, and canBook without leaking provider economics', async () => {
    bindRpc.mockResolvedValue({
      data: { available_balance: 1_000 },
      error: null,
    });
    const response = await subject({ receiver });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      availableBalance: 1_000,
      shortfall: 10_000,
      canBook: false,
    });
    expect(body.quote).not.toHaveProperty('providerCost');
    expect(body.quote).not.toHaveProperty('platformMargin');
    expect(body.quote).not.toHaveProperty('marginBasisPoints');
    expect(body.quote).not.toHaveProperty('pricingVersion');
    expect(body.quote).not.toHaveProperty('rawResponse');
  });

  it('reports canBook for exact wallet balance', async () => {
    bindRpc.mockResolvedValue({
      data: { available_balance: quote.price },
      error: null,
    });
    const body = await (await subject({ receiver })).json();
    expect(body).toMatchObject({
      availableBalance: quote.price,
      shortfall: 0,
      canBook: true,
    });
  });

  it('keeps excess wallet balance and reports no shortfall', async () => {
    bindRpc.mockResolvedValue({
      data: { available_balance: quote.price + 500 },
      error: null,
    });
    const body = await (await subject({ receiver })).json();
    expect(body).toMatchObject({
      availableBalance: quote.price + 500,
      shortfall: 0,
      canBook: true,
    });
  });

  it('does not expose the internal provider response in the public quote', async () => {
    const body = await (await subject({ receiver })).json();
    expect(body.quote).toEqual(
      expect.objectContaining({
        id: quoteId,
        provider: 'GIGL',
        price: quote.price,
      })
    );
    expect(JSON.stringify(body)).not.toContain('secretProviderPayload');
  });
});
