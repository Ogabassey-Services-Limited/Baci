// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  notifyMerchant: vi.fn().mockResolvedValue({ sent: 1, failed: 0, errors: [] }),
  sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'email-1' }),
  getCachedMerchantById: vi.fn(),
  from: vi.fn(),
  repairFrom: vi.fn(),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyMerchant: (...args: unknown[]) => mocks.notifyMerchant(...args),
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: (...args: unknown[]) => mocks.sendEmail(...args),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchantById: (...args: unknown[]) =>
    mocks.getCachedMerchantById(...args),
  getPublicSupabaseClient: () => ({ from: mocks.from }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createClient: () => ({ from: mocks.repairFrom }),
}));

const { notifyRepairBooking } = await import('./repair-notifications');

const baseParams = {
  merchantId: 'merchant-1',
  repairId: 'repair-1',
  ticketNumber: 42,
  customerName: 'Jane Doe',
  customerEmail: 'jane@example.com',
  deviceType: 'Smartphone',
  deviceModel: 'iPhone 13 Pro Max',
  serviceType: 'dropoff' as const,
  quoteId: null,
};

function buildQueryChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

describe('notifyRepairBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notifyMerchant.mockResolvedValue({ sent: 1, failed: 0, errors: [] });
    mocks.sendEmail.mockResolvedValue({ success: true, messageId: 'email-1' });
    mocks.getCachedMerchantById.mockResolvedValue({
      business_name: 'Ogabassey',
      payout_currency: 'NGN',
    });
    mocks.repairFrom.mockReturnValue(
      buildQueryChain({
        data: {
          device_type: 'Smartphone',
          device_model: 'iPhone 13 Pro Max',
        },
        error: null,
      })
    );
  });

  it('sends a merchant push notification with the repair payload type', async () => {
    await notifyRepairBooking(baseParams);

    expect(mocks.notifyMerchant).toHaveBeenCalledOnce();
    const [merchantId, title, body, data, channel] =
      mocks.notifyMerchant.mock.calls[0];
    expect(merchantId).toBe('merchant-1');
    expect(title).toContain('repair');
    expect(body).toContain('iPhone 13 Pro Max');
    expect(body).toContain('42');
    expect(data).toEqual({ type: 'repair', repair_id: 'repair-1' });
    expect(channel).toBe('orders');
  });

  it('sends a confirmation email to the customer with the ticket number', async () => {
    await notifyRepairBooking(baseParams);

    expect(mocks.sendEmail).toHaveBeenCalledOnce();
    const [params] = mocks.sendEmail.mock.calls[0];
    expect(params.to).toBe('jane@example.com');
    expect(params.merchantId).toBe('merchant-1');
    expect(params.emailType).toBe('orders');
    expect(params.subject).toContain('42');
    expect(params.htmlContent).toContain('iPhone 13 Pro Max');
  });

  it('uses the saved repair device values instead of caller-controlled values', async () => {
    mocks.repairFrom.mockReturnValueOnce(
      buildQueryChain({
        data: {
          device_type: 'Laptop',
          device_model: 'MacBook Pro 14',
        },
        error: null,
      })
    );

    await notifyRepairBooking({
      ...baseParams,
      deviceType: 'Tampered device type',
      deviceModel: 'Tampered device model',
    });

    const [, , pushBody] = mocks.notifyMerchant.mock.calls[0];
    expect(pushBody).toContain('MacBook Pro 14');
    expect(pushBody).not.toContain('Tampered device model');

    const [emailParams] = mocks.sendEmail.mock.calls[0];
    expect(emailParams.htmlContent).toContain('MacBook Pro 14');
    expect(emailParams.htmlContent).not.toContain('Tampered device model');
  });

  it('enriches the notification with the quote price and service name when quoteId is present', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'repair_quotes') {
        return buildQueryChain({
          data: { price: 25000, is_from_price: true, service_type_id: 'st-1' },
          error: null,
        });
      }
      if (table === 'repair_service_types') {
        return buildQueryChain({
          data: { name: 'Screen Replacement' },
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    await notifyRepairBooking({ ...baseParams, quoteId: 'quote-1' });

    const [, , body] = mocks.notifyMerchant.mock.calls[0];
    expect(body).toContain('Screen Replacement');

    const [emailParams] = mocks.sendEmail.mock.calls[0];
    expect(emailParams.htmlContent).toContain('Screen Replacement');
    expect(emailParams.htmlContent).toContain('25,000');
  });

  it('never throws when the quote lookup fails, falling back to device-only copy', async () => {
    mocks.from.mockImplementation(() => {
      throw new Error('db unavailable');
    });

    await expect(
      notifyRepairBooking({ ...baseParams, quoteId: 'quote-1' })
    ).resolves.toBeUndefined();

    expect(mocks.notifyMerchant).toHaveBeenCalledOnce();
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
  });

  it('never throws when the push notification fails', async () => {
    mocks.notifyMerchant.mockRejectedValueOnce(new Error('push down'));

    await expect(notifyRepairBooking(baseParams)).resolves.toBeUndefined();
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
  });

  it('never throws when the confirmation email fails', async () => {
    mocks.sendEmail.mockResolvedValueOnce({
      success: false,
      error: 'provider unavailable',
    });

    await expect(notifyRepairBooking(baseParams)).resolves.toBeUndefined();
    expect(mocks.notifyMerchant).toHaveBeenCalledOnce();
  });

  it('never throws when the merchant lookup fails, falling back to generic copy', async () => {
    mocks.getCachedMerchantById.mockRejectedValueOnce(
      new Error('lookup failed')
    );

    await expect(notifyRepairBooking(baseParams)).resolves.toBeUndefined();
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
  });

  it('includes the pickup address in the email when service type is pickup', async () => {
    await notifyRepairBooking({
      ...baseParams,
      serviceType: 'pickup',
      pickupAddress: '12 Adeola Odeku Street',
    });

    const [emailParams] = mocks.sendEmail.mock.calls[0];
    expect(emailParams.htmlContent).toContain('12 Adeola Odeku Street');
  });
});
