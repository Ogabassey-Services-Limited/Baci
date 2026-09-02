import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRepairPickupPayment } from './handle-repair-pickup-payment';
import { repairPickupPaymentClaims } from './repair-pickup-payment-claim';

const mocks = vi.hoisted(() => ({ bookRepairPickup: vi.fn() }));

vi.mock('@/lib/repairs/book-repair-pickup', () => ({
  bookRepairPickup: mocks.bookRepairPickup,
}));

const secret = 'paystack-secret-for-tests';
const merchantId = '123e4567-e89b-12d3-a456-426614174000';
const repairId = '223e4567-e89b-12d3-a456-426614174000';
const reference = 'RPU-ABC123';

function paymentMetadata() {
  return repairPickupPaymentClaims.create(
    {
      amountKobo: 825_000,
      currency: 'NGN',
      merchantId,
      reference,
      repairId,
    },
    secret
  );
}

function createSupabase(confirmed = true) {
  const rpc = vi.fn().mockResolvedValue({
    data: [{ confirmed }],
    error: null,
  });
  const thirdEq = vi.fn().mockResolvedValue({ error: null });
  const secondEq = vi.fn().mockReturnValue({ eq: thirdEq });
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
  const update = vi.fn().mockReturnValue({ eq: firstEq });
  const from = vi.fn().mockReturnValue({ update });
  return {
    client: { from, rpc } as never,
    firstEq,
    from,
    rpc,
    secondEq,
    thirdEq,
    update,
  };
}

describe('handleRepairPickupPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYSTACK_SECRET_KEY = secret;
    mocks.bookRepairPickup.mockResolvedValue({
      ok: true,
      carrierName: 'GIG Logistics',
      pickupScheduledAt: null,
      shipmentId: 'shipment-1',
      trackingNumber: '1349000000',
    });
  });

  it('ignores verified payments that are not repair pickups', async () => {
    const { client, rpc } = createSupabase();

    const result = await handleRepairPickupPayment({
      gateway: 'paystack',
      gatewayResponse: { currency: 'NGN', metadata: {} },
      reference,
      supabase: client,
      verifiedAmount: 8250,
    });

    expect(result).toEqual({ handled: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('confirms payment before booking the pickup exactly once', async () => {
    const { client, rpc } = createSupabase();

    const result = await handleRepairPickupPayment({
      gateway: 'paystack',
      gatewayResponse: {
        currency: 'NGN',
        metadata: paymentMetadata(),
      },
      reference,
      supabase: client,
      verifiedAmount: 8250,
    });

    expect(result).toEqual({
      handled: true,
      status: 200,
      body: {
        message: 'Repair pickup payment confirmed and shipment booked',
        trackingNumber: '1349000000',
      },
    });
    expect(rpc).toHaveBeenCalledWith('confirm_repair_pickup_payment', {
      p_amount: 8250,
      p_currency: 'NGN',
      p_gateway_response: expect.objectContaining({ currency: 'NGN' }),
      p_merchant_id: merchantId,
      p_reference: reference,
      p_repair_id: repairId,
    });
    expect(mocks.bookRepairPickup).toHaveBeenCalledOnce();
  });

  it('does not confirm or book a tampered payment amount', async () => {
    const { client, rpc } = createSupabase();

    const result = await handleRepairPickupPayment({
      gateway: 'paystack',
      gatewayResponse: {
        currency: 'NGN',
        metadata: paymentMetadata(),
      },
      reference,
      supabase: client,
      verifiedAmount: 8000,
    });

    expect(result).toEqual({
      handled: true,
      status: 200,
      body: { message: 'Repair pickup payment requires review' },
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(mocks.bookRepairPickup).not.toHaveBeenCalled();
  });

  it('does not confirm a pickup claim with an invalid signature', async () => {
    const { client, rpc } = createSupabase();
    const metadata = paymentMetadata();

    const result = await handleRepairPickupPayment({
      gateway: 'paystack',
      gatewayResponse: {
        currency: 'NGN',
        metadata: { ...metadata, pickup_claim_signature: 'invalid' },
      },
      reference,
      supabase: client,
      verifiedAmount: 8250,
    });

    expect(result).toMatchObject({ handled: true, status: 200 });
    expect(rpc).not.toHaveBeenCalled();
    expect(mocks.bookRepairPickup).not.toHaveBeenCalled();
  });

  it('asks Paystack to retry when atomic payment confirmation fails', async () => {
    const { client, rpc } = createSupabase();
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });

    const result = await handleRepairPickupPayment({
      gateway: 'paystack',
      gatewayResponse: { currency: 'NGN', metadata: paymentMetadata() },
      reference,
      supabase: client,
      verifiedAmount: 8250,
    });

    expect(result).toMatchObject({ handled: true, status: 503 });
    expect(mocks.bookRepairPickup).not.toHaveBeenCalled();
  });

  it('reuses the confirmed repair on a duplicate webhook', async () => {
    const { client } = createSupabase(false);
    mocks.bookRepairPickup.mockResolvedValueOnce({
      ok: false,
      reason: 'already_booked',
      message: 'Already booked',
      canRetryManually: false,
    });

    const result = await handleRepairPickupPayment({
      gateway: 'paystack',
      gatewayResponse: {
        currency: 'NGN',
        metadata: paymentMetadata(),
      },
      reference,
      supabase: client,
      verifiedAmount: 8250,
    });

    expect(result).toEqual({
      handled: true,
      status: 200,
      body: { message: 'Repair pickup payment already processed' },
    });
    expect(mocks.bookRepairPickup).toHaveBeenCalledOnce();
  });

  it('marks an ambiguous provider result for review without retrying the webhook', async () => {
    const { client, firstEq, secondEq, thirdEq, update } = createSupabase();
    mocks.bookRepairPickup.mockResolvedValueOnce({
      ok: false,
      reason: 'shipment_save_failed',
      message: 'Shipment persistence is ambiguous',
      canRetryManually: false,
    });

    const result = await handleRepairPickupPayment({
      gateway: 'paystack',
      gatewayResponse: {
        currency: 'NGN',
        metadata: paymentMetadata(),
      },
      reference,
      supabase: client,
      verifiedAmount: 8250,
    });

    expect(result).toEqual({
      handled: true,
      status: 200,
      body: {
        message: 'Repair pickup payment confirmed; shipment requires review',
      },
    });
    expect(update).toHaveBeenCalledWith({ pickup_payment_status: 'review' });
    expect(firstEq).toHaveBeenCalledWith('id', repairId);
    expect(secondEq).toHaveBeenCalledWith('merchant_id', merchantId);
    expect(thirdEq).toHaveBeenCalledWith('pickup_payment_reference', reference);
  });

  it('marks carrier availability failures retrying and asks Paystack to retry', async () => {
    const { client, update } = createSupabase();
    mocks.bookRepairPickup.mockResolvedValueOnce({
      ok: false,
      reason: 'gigl_unavailable',
      message: 'GIGL temporarily unavailable',
      canRetryManually: true,
    });

    const result = await handleRepairPickupPayment({
      gateway: 'paystack',
      gatewayResponse: {
        currency: 'NGN',
        metadata: paymentMetadata(),
      },
      reference,
      supabase: client,
      verifiedAmount: 8250,
    });

    expect(result).toMatchObject({ handled: true, status: 503 });
    expect(update).toHaveBeenCalledWith({ pickup_payment_status: 'retrying' });
  });

  it('acknowledges definitive booking failures even if review persistence fails', async () => {
    const { client, thirdEq } = createSupabase();
    thirdEq.mockResolvedValueOnce({ error: { message: 'write failed' } });
    mocks.bookRepairPickup.mockResolvedValueOnce({
      ok: false,
      reason: 'quote_increased',
      message: 'Quote increased',
      canRetryManually: false,
    });

    const result = await handleRepairPickupPayment({
      gateway: 'paystack',
      gatewayResponse: { currency: 'NGN', metadata: paymentMetadata() },
      reference,
      supabase: client,
      verifiedAmount: 8250,
    });

    expect(result).toMatchObject({ handled: true, status: 200 });
  });
});
