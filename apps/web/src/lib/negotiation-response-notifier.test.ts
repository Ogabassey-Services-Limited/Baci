import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyNegotiationResponseWithFallback } from './negotiation-response-notifier';

const mockNotifyNegotiationResponse = vi.fn();
const mockNotifyGuestNegotiationResponseByEmail = vi.fn();

vi.mock('@/lib/negotiation-notifications', () => ({
  notifyGuestNegotiationResponseByEmail: (...args: unknown[]) =>
    mockNotifyGuestNegotiationResponseByEmail(...args),
  notifyNegotiationResponse: (...args: unknown[]) =>
    mockNotifyNegotiationResponse(...args),
}));

const baseParams = {
  acceptedPrice: 5000,
  itemName: 'Test Product',
  merchantId: 'merchant-1',
  negotiationId: 'negotiation-1',
  negotiationType: 'single' as const,
  productSlug: 'test-product',
  status: 'accepted' as const,
};

describe('notifyNegotiationResponseWithFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifyNegotiationResponse.mockResolvedValue({
      sent: 1,
      failed: 0,
      errors: [],
    });
    mockNotifyGuestNegotiationResponseByEmail.mockResolvedValue(undefined);
  });

  it('sends email for guest negotiations with captured email', async () => {
    await expect(
      notifyNegotiationResponseWithFallback({
        ...baseParams,
        customerEmail: 'guest@example.com',
        customerId: null,
      })
    ).resolves.toEqual({ notified: true, channel: 'email' });

    expect(mockNotifyNegotiationResponse).not.toHaveBeenCalled();
    expect(mockNotifyGuestNegotiationResponseByEmail).toHaveBeenCalledWith({
      acceptedPrice: 5000,
      email: 'guest@example.com',
      itemName: 'Test Product',
      merchantId: 'merchant-1',
      negotiationId: 'negotiation-1',
      negotiationType: 'single',
      productSlug: 'test-product',
      status: 'accepted',
    });
  });

  it('returns no_customer_email for guest negotiations without email', async () => {
    await expect(
      notifyNegotiationResponseWithFallback({
        ...baseParams,
        customerEmail: null,
        customerId: null,
      })
    ).resolves.toEqual({ notified: false, reason: 'no_customer_email' });

    expect(mockNotifyNegotiationResponse).not.toHaveBeenCalled();
    expect(mockNotifyGuestNegotiationResponseByEmail).not.toHaveBeenCalled();
  });

  it('uses push notification for authenticated customers with devices', async () => {
    await expect(
      notifyNegotiationResponseWithFallback({
        ...baseParams,
        customerEmail: 'customer@example.com',
        customerId: 'customer-1',
      })
    ).resolves.toEqual({ notified: true });

    expect(mockNotifyNegotiationResponse).toHaveBeenCalledWith(
      'customer-1',
      'single',
      'accepted',
      'negotiation-1',
      'Test Product',
      5000,
      'test-product'
    );
    expect(mockNotifyGuestNegotiationResponseByEmail).not.toHaveBeenCalled();
  });

  it('falls back to email when push reaches no customer devices', async () => {
    mockNotifyNegotiationResponse.mockResolvedValueOnce({
      sent: 0,
      failed: 0,
      errors: [],
    });

    await expect(
      notifyNegotiationResponseWithFallback({
        ...baseParams,
        customerEmail: 'customer@example.com',
        customerId: 'customer-1',
      })
    ).resolves.toEqual({ notified: true, channel: 'email' });

    expect(mockNotifyGuestNegotiationResponseByEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'customer@example.com',
        negotiationId: 'negotiation-1',
      })
    );
  });

  it('reports no delivery channel when push reaches no devices and no email exists', async () => {
    mockNotifyNegotiationResponse.mockResolvedValueOnce({
      sent: 0,
      failed: 0,
      errors: [],
    });

    await expect(
      notifyNegotiationResponseWithFallback({
        ...baseParams,
        customerEmail: null,
        customerId: 'customer-1',
      })
    ).resolves.toEqual({ notified: false, reason: 'no_delivery_channel' });

    expect(mockNotifyGuestNegotiationResponseByEmail).not.toHaveBeenCalled();
  });

  it('falls back to email when push notification throws', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockNotifyNegotiationResponse.mockRejectedValueOnce(
      new Error('push provider unavailable')
    );

    await expect(
      notifyNegotiationResponseWithFallback({
        ...baseParams,
        customerEmail: 'customer@example.com',
        customerId: 'customer-1',
      })
    ).resolves.toEqual({ notified: true, channel: 'email' });

    expect(mockNotifyGuestNegotiationResponseByEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'customer@example.com',
        negotiationId: 'negotiation-1',
      })
    );
    expect(consoleError).toHaveBeenCalledWith(
      'Push negotiation notification failed; falling back to email',
      expect.objectContaining({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        negotiationId: 'negotiation-1',
        negotiationType: 'single',
        status: 'accepted',
      })
    );
    consoleError.mockRestore();
  });

  it('reports no delivery channel when push throws and no email exists', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockNotifyNegotiationResponse.mockRejectedValueOnce(
      new Error('push provider unavailable')
    );

    await expect(
      notifyNegotiationResponseWithFallback({
        ...baseParams,
        customerEmail: null,
        customerId: 'customer-1',
      })
    ).resolves.toEqual({ notified: false, reason: 'no_delivery_channel' });

    expect(mockNotifyGuestNegotiationResponseByEmail).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      'Push negotiation notification failed; falling back to email',
      expect.objectContaining({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        negotiationId: 'negotiation-1',
        negotiationType: 'single',
        status: 'accepted',
      })
    );
    consoleError.mockRestore();
  });
});
