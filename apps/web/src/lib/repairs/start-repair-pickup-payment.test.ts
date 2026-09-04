import { beforeEach, describe, expect, it, vi } from 'vitest';
import { repairPickupPaymentClaims } from './repair-pickup-payment-claim';
import { startRepairPickupPayment } from './start-repair-pickup-payment';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createRepairBooking: vi.fn(),
  ensureActionRateLimit: vi.fn(),
  getRepairCenterAddress: vi.fn(),
  initializeTransaction: vi.fn(),
  quoteRepairPickup: vi.fn(),
  resolveWalletTopUpMerchant: vi.fn(),
  rpc: vi.fn(),
}));

function _createSupabaseMock() {
  return { rpc: mocks.rpc };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));
vi.mock('@/lib/resolve-wallet-top-up-merchant', () => ({
  resolveWalletTopUpMerchant: mocks.resolveWalletTopUpMerchant,
}));
vi.mock('@/lib/ensure-action-rate-limit', () => ({
  ensureActionRateLimit: mocks.ensureActionRateLimit,
}));
vi.mock('@/lib/repairs/create-repair-core', () => ({
  createRepairBooking: mocks.createRepairBooking,
}));
vi.mock('@/lib/repairs/quote-repair-pickup', () => ({
  quoteRepairPickup: mocks.quoteRepairPickup,
}));
vi.mock('@/lib/repairs/repair-center-address', () => ({
  getRepairCenterAddress: mocks.getRepairCenterAddress,
}));
vi.mock('@/lib/paystack', () => ({
  initializeTransaction: mocks.initializeTransaction,
}));

const merchantId = '123e4567-e89b-12d3-a456-426614174000';
const repairId = '223e4567-e89b-12d3-a456-426614174000';
const input = {
  customerEmail: 'ada@example.com',
  customerName: 'Ada Lovelace',
  customerPhone: '+2348012345678',
  deviceModel: 'iPhone 15',
  deviceType: 'Smartphone' as const,
  issueDescription: 'The screen no longer responds to touch.',
  pickupAddress: '12 Station Road, Osogbo, Osun, Nigeria',
  preferredDate: '2026-09-10T09:00',
  serviceType: 'pickup' as const,
};
const center = {
  address: '2 Olaide Tomori Street, Ikeja',
  city: 'Ikeja',
  country: 'Nigeria',
  countryCode: 'NG',
  email: 'repairs@example.com',
  name: 'Repair Centre',
  phone: '+2348011111111',
  state: 'Lagos',
};
const quote = {
  carrierName: 'GIG Logistics',
  currency: 'NGN',
  estimatedDays: 3,
  expiresAt: new Date('2026-09-02T12:00:00.000Z'),
  price: 8250,
  provider: 'GIGL',
  providerRateId: 'gigl-rate',
  serviceTier: 'GoStandard',
};

describe('startRepairPickupPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYSTACK_SECRET_KEY = 'paystack-secret-for-tests';
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    mocks.ensureActionRateLimit.mockResolvedValue(true);
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.createClient.mockResolvedValue(_createSupabaseMock());
    mocks.resolveWalletTopUpMerchant.mockResolvedValue({
      id: merchantId,
      is_published: true,
      slug: 'ogabassey',
    });
    mocks.getRepairCenterAddress.mockResolvedValue(center);
    mocks.quoteRepairPickup.mockResolvedValue({
      quote,
      request: { items: [], receiver: center, sender: {} },
    });
    mocks.createRepairBooking.mockResolvedValue({
      success: true,
      id: repairId,
      ticketNumber: 42,
    });
    mocks.initializeTransaction.mockResolvedValue({
      access_code: 'access-code',
      authorization_url: 'https://checkout.paystack.com/access-code',
      reference: 'provider-reference',
    });
  });

  it('does not call GIGL or create payment when the public action is rate limited', async () => {
    mocks.ensureActionRateLimit.mockResolvedValueOnce(false);

    const result = await startRepairPickupPayment({
      data: input,
      expectedPickupFee: 8250,
      merchantId,
      merchantIdentifier: 'ogabassey',
    });

    expect(result).toMatchObject({
      success: false,
      code: 'rate_limited',
    });
    expect(mocks.quoteRepairPickup).not.toHaveBeenCalled();
    expect(mocks.createRepairBooking).not.toHaveBeenCalled();
    expect(mocks.initializeTransaction).not.toHaveBeenCalled();
  });

  it('creates a pending repair and initializes the exact quoted pickup payment', async () => {
    const result = await startRepairPickupPayment({
      data: input,
      expectedPickupFee: 8250,
      merchantId,
      merchantIdentifier: 'ogabassey',
    });

    expect(result).toMatchObject({
      success: true,
      id: repairId,
      ticketNumber: 42,
      payment: {
        amount: 8250,
        authorizationUrl: 'https://checkout.paystack.com/access-code',
      },
    });
    const initPayload = mocks.initializeTransaction.mock.calls[0]?.[0];
    expect(initPayload.amount).toBe(825_000);
    expect(initPayload.email).toBe('ada@example.com');
    expect(initPayload.callback_url).toBe(
      'http://ogabassey.usebaci.com/repair/status?ticket=42'
    );
    expect(
      repairPickupPaymentClaims.verify(
        initPayload.metadata,
        'paystack-secret-for-tests'
      )
    ).toEqual({
      amountKobo: 825_000,
      currency: 'NGN',
      merchantId,
      reference: initPayload.reference,
      repairId,
    });
  });

  it('does not create a repair or charge when the live pickup price changed', async () => {
    const result = await startRepairPickupPayment({
      data: input,
      expectedPickupFee: 8000,
      merchantId,
      merchantIdentifier: 'ogabassey',
    });

    expect(result).toEqual({
      success: false,
      code: 'quote_changed',
      error: 'The pickup price changed. Review the new price before paying.',
      quote: { formattedPrice: '₦8,250', price: 8250 },
    });
    expect(mocks.createRepairBooking).not.toHaveBeenCalled();
    expect(mocks.initializeTransaction).not.toHaveBeenCalled();
  });

  it('does not create an orphan repair when Paystack is not configured', async () => {
    delete process.env.PAYSTACK_SECRET_KEY;

    const result = await startRepairPickupPayment({
      data: input,
      expectedPickupFee: 8250,
      merchantId,
      merchantIdentifier: 'ogabassey',
    });

    expect(result).toMatchObject({
      success: false,
      code: 'payment_initialization_failed',
    });
    expect(mocks.createRepairBooking).not.toHaveBeenCalled();
    expect(mocks.initializeTransaction).not.toHaveBeenCalled();
  });

  it('returns the created ticket when Paystack initialization fails', async () => {
    mocks.initializeTransaction.mockRejectedValueOnce(
      new Error('Paystack unavailable')
    );

    const result = await startRepairPickupPayment({
      data: input,
      expectedPickupFee: 8250,
      merchantId,
      merchantIdentifier: 'ogabassey',
    });

    expect(result).toEqual({
      success: false,
      code: 'payment_initialization_failed',
      error:
        'Your repair request was saved, but payment could not start. Use your ticket to retry shortly.',
      id: repairId,
      ticketNumber: 42,
    });
  });

  it('returns pickup_unavailable when the live quote request throws', async () => {
    mocks.quoteRepairPickup.mockRejectedValueOnce(new Error('GIGL offline'));

    const result = await startRepairPickupPayment({
      data: input,
      expectedPickupFee: 8250,
      merchantId,
      merchantIdentifier: 'ogabassey',
    });

    expect(result).toEqual({
      success: false,
      code: 'pickup_unavailable',
      error: 'Courier pickup is not available for this address.',
    });
    expect(mocks.createRepairBooking).not.toHaveBeenCalled();
    expect(mocks.initializeTransaction).not.toHaveBeenCalled();
  });

  it('reclaims an unpaid pickup via the authorized RPC instead of creating a duplicate', async () => {
    const existingId = '323e4567-e89b-12d3-a456-426614174000';
    mocks.rpc.mockResolvedValueOnce({
      data: [{ id: existingId, ticket_number: 17 }],
      error: null,
    });

    const result = await startRepairPickupPayment({
      data: input,
      expectedPickupFee: 8250,
      merchantId,
      merchantIdentifier: 'ogabassey',
    });

    expect(mocks.rpc).toHaveBeenCalledWith('find_resumable_repair_pickup', {
      p_merchant_id: merchantId,
      p_customer_email: input.customerEmail,
    });
    expect(mocks.createRepairBooking).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      id: existingId,
      ticketNumber: 17,
    });
  });

  it('rejects invalid expected pickup fees before merchant lookup', async () => {
    const result = await startRepairPickupPayment({
      data: input,
      expectedPickupFee: -10,
      merchantId,
      merchantIdentifier: 'ogabassey',
    });

    expect(result).toEqual({
      success: false,
      code: 'validation_failed',
      error: 'Enter valid repair and pickup details.',
    });
    expect(mocks.resolveWalletTopUpMerchant).not.toHaveBeenCalled();
  });

  it('rejects a non-string or oversized merchant identifier before lookup', async () => {
    const result = await startRepairPickupPayment({
      data: input,
      expectedPickupFee: 8250,
      merchantId,
      merchantIdentifier: 'a'.repeat(121) as never,
    });

    expect(result).toEqual({
      success: false,
      code: 'validation_failed',
      error: 'Enter valid repair and pickup details.',
    });
    expect(mocks.resolveWalletTopUpMerchant).not.toHaveBeenCalled();
  });
});
