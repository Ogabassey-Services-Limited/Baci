import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuthenticateApiRequest,
  mockComputeAgenticOrderTax,
  mockComputeOrderNegotiationDiscount,
  mockCreateAdminClient,
  mockCreateQuizRpcServerProof,
  mockRecordPlatformOrderCreatedEvent,
} = vi.hoisted(() => ({
  mockAuthenticateApiRequest: vi.fn(),
  mockComputeAgenticOrderTax: vi.fn(),
  mockComputeOrderNegotiationDiscount: vi.fn(),
  mockCreateAdminClient: vi.fn(),
  mockCreateQuizRpcServerProof: vi.fn(),
  mockRecordPlatformOrderCreatedEvent: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticateApiRequest,
  hasPermission: vi.fn(() => true),
}));

vi.mock('@/lib/agentic/checkout-order-tax', () => ({
  computeAgenticOrderTax: mockComputeAgenticOrderTax,
  isTaxComputeUuidError: vi.fn(() => false),
}));

vi.mock('@/lib/checkout/order-negotiation-discount', () => ({
  computeOrderNegotiationDiscount: mockComputeOrderNegotiationDiscount,
}));

vi.mock('@/lib/create-platform-order-event', () => ({
  recordPlatformOrderCreatedEvent: mockRecordPlatformOrderCreatedEvent,
}));

vi.mock('@/lib/events/record-platform-order-created-event', () => ({
  recordPlatformOrderCreatedEvent: mockRecordPlatformOrderCreatedEvent,
}));

vi.mock('@/lib/geo-privacy', () => ({
  detectPrivacyRegion: vi.fn().mockResolvedValue({
    country: 'NG',
    region: 'Lagos',
    shouldApplyLDU: false,
  }),
}));

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateProductSlugs: vi.fn(),
  revalidateProducts: vi.fn(),
}));

vi.mock('@/lib/payments/record-pre-gateway-redemption', () => ({
  recordPreGatewayRedemption: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/env', () => ({
  getQuizPhaseEnv: () => '1a',
  getQuizProductionApprovedEnv: () => false,
  getQuizRpcServerSecret: () => undefined,
  getSupabaseAnonKey: () => 'mock-key',
  getSupabaseServiceRoleKey: () => 'mock-service-key',
  getSupabaseUrl: () => 'https://mock.supabase.co',
  getRootDomain: () => 'localhost:3000',
}));

vi.mock('@/lib/expo-push', () => ({
  notifyNewOrder: vi.fn(),
  notifyPaymentReceived: vi.fn(),
}));

vi.mock('@/lib/zeptomail', () => ({ sendEmail: vi.fn() }));
vi.mock('@/lib/email-templates', () => ({
  generateOrderConfirmationEmail: vi.fn(),
  generateOrderConfirmationText: vi.fn(),
}));
vi.mock('@/lib/paystack', () => ({ generatePaymentAccount: vi.fn() }));
vi.mock('@/lib/receipt-pdf-generator', () => ({
  generateReceiptBlob: vi.fn(),
  resolveReceiptLogoDataUri: vi.fn(),
}));
vi.mock('@/lib/quiz-compliance-gate', () => ({
  enforcePrizeProductionGuard: vi.fn(),
  QuizProductionNotApprovedError: class extends Error {},
}));
vi.mock('@/lib/quiz-proof', () => ({
  createQuizRpcServerProof: mockCreateQuizRpcServerProof,
}));
vi.mock('@/lib/quiz-voucher-token', () => ({
  verifyQuizVoucherToken: vi.fn(),
}));
vi.mock('@/lib/shipping/merchant-rates/get-merchant-shipping-rates', () => ({
  getMerchantShippingRates: vi.fn(),
  MerchantShippingRatesLoadError: class extends Error {},
}));
vi.mock('@/lib/shipping/merchant-rates/verify-order-shipping-rate', () => ({
  verifyOrderShippingRate: vi.fn(),
}));
vi.mock('@/lib/shipping/order-quote-destination', () => ({
  enrichShippingAddressWithQuoteDestination: vi.fn(
    (_supabase, _quoteId, address) => Promise.resolve(address)
  ),
  OrderQuoteDestinationMismatchError: class extends Error {},
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { POST } = await import('./route');

const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';
let latestRpc: ReturnType<typeof vi.fn>;

function createOrderRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      merchant_id: MERCHANT_ID,
      customer_email: 'customer@example.com',
      customer_name: 'Test Customer',
      customer_phone: '08012345678',
      items: [
        {
          product_id: 'p-mac',
          quantity: 1,
          price: 980,
          name: 'MacBook Air M1',
          has_assurance: true,
        },
      ],
      subtotal: 980,
      shipping_fee: 0,
      discount_amount: 0,
      tax_amount: 73.5,
      payment_method: 'paystack',
      payment_status: 'unpaid',
      shipping_status: 'pending',
      shipping_address: {
        address: '123 Test St',
        city: 'Lagos',
        state: 'Lagos',
      },
      source: 'mobile_app',
      ...overrides,
    }),
  });
}

function buildSupabaseMock() {
  const rpc = vi.fn().mockResolvedValue({
    data: [
      {
        id: 'order-id',
        order_number: 'ORD-123',
        total: 1000,
        subtotal: 1000,
        shipping_fee: 0,
        customer_id: null,
        created_at: '2026-08-27T00:00:00.000Z',
      },
    ],
    error: null,
  });
  const shared = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue({ data: [], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({
      data: {
        id: MERCHANT_ID,
        business_name: 'Test Merchant',
        country: 'NG',
        plan_tier: 'pro',
        slug: 'test-merchant',
        support_email: 'support@example.com',
        email_sender_name: 'Test Store',
        email: 'merchant@example.com',
        vat_registration_status: 'registered',
      },
      error: null,
    }),
  };
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'merchants') return shared;
      if (table === 'products') return shared;
      return shared;
    }),
    rpc,
  };
  latestRpc = rpc;
  return { rpc, supabase };
}

describe('POST /api/orders transaction discount metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { supabase } = buildSupabaseMock();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase,
      user: null,
    });
    mockComputeAgenticOrderTax.mockResolvedValue(75);
    mockComputeOrderNegotiationDiscount.mockResolvedValue({
      lineDiscounts: [
        {
          lineId: 1,
          merchandiseDiscount: 20,
          productId: 'p-mac',
          vatRelief: 1.5,
          variantId: null,
        },
      ],
      rejectionCode: null,
      totalDiscount: 21.5,
    });
    mockCreateQuizRpcServerProof.mockReturnValue({
      action: 'storefront_transaction_discount',
      issued_at: '2026-08-28T00:00:00.000Z',
      payload: {
        lineDiscounts: [
          {
            lineId: 1,
            merchandiseDiscount: 20,
            productId: 'p-mac',
            vatRelief: 1.5,
            variantId: null,
          },
        ],
        version: 3,
      },
      payload_hash: '0'.repeat(64),
      proof_id: 'proof-id',
      scope: 'quiz_phase1a',
      signature: '0'.repeat(64),
      subject_id: MERCHANT_ID,
      user_id: 'guest',
      version: 'quiz-rpc-proof:v1',
    });
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { currency: 'NGN', shipping_provider: null },
          error: null,
        }),
      })),
    });
    mockRecordPlatformOrderCreatedEvent.mockResolvedValue(undefined);
  });

  it('persists mobile negotiated line discounts when expected_total is omitted', async () => {
    const request = createOrderRequest();

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(latestRpc).toHaveBeenCalledWith(
      'create_storefront_order',
      expect.objectContaining({
        p_discount_amount: 21.5,
        p_expected_total: null,
        p_source: 'mobile_app',
        p_tax_amount: 75,
        p_ad_tracking: expect.objectContaining({
          baci_transaction_discount: {
            lineDiscounts: [
              {
                lineId: 1,
                merchandiseDiscount: 20,
                productId: 'p-mac',
                vatRelief: 1.5,
                variantId: null,
              },
            ],
            proof: expect.objectContaining({
              action: 'storefront_transaction_discount',
              payload: expect.objectContaining({ version: 3 }),
            }),
            version: 3,
          },
        }),
      })
    );
  });

  it('fails closed when transaction discount provenance signing is unavailable', async () => {
    mockCreateQuizRpcServerProof.mockImplementation(() => {
      throw new Error('missing_quiz_rpc_server_secret');
    });

    const response = await POST(createOrderRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: 'TRANSACTION_DISCOUNT_PROOF_UNAVAILABLE',
      error: 'Unable to create order right now. Please try again.',
    });
    expect(latestRpc).not.toHaveBeenCalled();
  });

  it('omits transaction discount metadata when no line allocations exist', async () => {
    mockComputeOrderNegotiationDiscount.mockResolvedValue({
      rejectionCode: null,
      totalDiscount: 0,
    });

    const response = await POST(createOrderRequest());

    expect(response.status).toBe(201);
    const adTracking = latestRpc.mock.calls[0]?.[1]?.p_ad_tracking;
    expect(adTracking?.baci_transaction_discount).toBeUndefined();
  });
});
