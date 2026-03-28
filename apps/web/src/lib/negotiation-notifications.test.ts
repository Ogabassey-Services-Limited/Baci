import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyMerchant = vi
  .fn()
  .mockResolvedValue({ sent: 1, failed: 0, errors: [] });
const mockNotifyCustomer = vi
  .fn()
  .mockResolvedValue({ sent: 1, failed: 0, errors: [] });

vi.mock('@/lib/expo-push', () => ({
  formatCurrency: (amount: number, currency = 'NGN') =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount),
  notifyMerchant: (...args: unknown[]) => mockNotifyMerchant(...args),
  notifyCustomer: (...args: unknown[]) => mockNotifyCustomer(...args),
}));

const { notifyNegotiationRequest, notifyNegotiationResponse } = await import(
  './negotiation-notifications'
);

describe('notifyNegotiationRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends single-item negotiation with discount percentage', async () => {
    await notifyNegotiationRequest(
      'm1',
      'single',
      8000,
      'n1',
      'Laptop Stand',
      10000
    );

    expect(mockNotifyMerchant).toHaveBeenCalledOnce();
    const [, title, body, data, channel] = mockNotifyMerchant.mock.calls[0];
    expect(title).toContain('Negotiation');
    expect(body).toContain('Laptop Stand');
    expect(body).toContain('20%');
    expect(body).toContain('₦8,000');
    expect(data.negotiation_id).toBe('n1');
    expect(channel).toBe('orders');
  });

  it('sends cart-level negotiation without item details', async () => {
    await notifyNegotiationRequest('m1', 'total', 25000, 'n2', null, null);

    const [, , body] = mockNotifyMerchant.mock.calls[0];
    expect(body).toContain('Cart total');
    expect(body).not.toContain('undefined');
  });

  it('handles currentPrice of 0 without divide-by-zero', async () => {
    await notifyNegotiationRequest('m1', 'single', 500, 'n3', 'Free Item', 0);

    const [, , body] = mockNotifyMerchant.mock.calls[0];
    // currentPrice === 0 is not null, so it takes the item branch
    expect(body).toContain('Free Item');
    expect(body).not.toContain('Infinity');
    expect(body).not.toContain('NaN');
  });

  it('handles currentPrice == null with cart message', async () => {
    await notifyNegotiationRequest('m1', 'single', 500, 'n4', 'Shirt', null);

    const [, , body] = mockNotifyMerchant.mock.calls[0];
    expect(body).toContain('Cart total');
  });

  it('does not show discount when offeredPrice >= currentPrice', async () => {
    await notifyNegotiationRequest('m1', 'single', 12000, 'n5', 'Watch', 10000);

    const [, , body] = mockNotifyMerchant.mock.calls[0];
    expect(body).toContain('Watch');
    expect(body).not.toContain('%');
  });
});

describe('notifyNegotiationResponse', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends accepted notification for single item with price', async () => {
    await notifyNegotiationResponse(
      'u1',
      'single',
      'accepted',
      'n1',
      'Laptop Stand',
      8000
    );

    expect(mockNotifyCustomer).toHaveBeenCalledOnce();
    const [, title, body, data, channel] = mockNotifyCustomer.mock.calls[0];
    expect(title).toContain('Accepted');
    expect(body).toContain('Laptop Stand');
    expect(body).toContain('₦8,000');
    expect(data.type).toBe('negotiation_response');
    expect(data.status).toBe('accepted');
    expect(channel).toBe('orders');
  });

  it('sends rejected notification for cart-level negotiation', async () => {
    await notifyNegotiationResponse(
      'u1',
      'total',
      'rejected',
      'n2',
      null,
      null
    );

    const [, title, body] = mockNotifyCustomer.mock.calls[0];
    expect(title).toContain('Declined');
    expect(body).toContain('cart offer');
    expect(body).not.toContain('undefined');
  });

  it('sends accepted notification without price when offeredPrice is null', async () => {
    await notifyNegotiationResponse(
      'u1',
      'single',
      'accepted',
      'n3',
      'Shirt',
      null
    );

    const [, , body] = mockNotifyCustomer.mock.calls[0];
    expect(body).toContain('Shirt');
    expect(body).toContain('accepted');
    expect(body).not.toContain('₦');
  });
});
