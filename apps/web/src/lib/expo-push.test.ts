import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

// Mock global fetch to intercept Expo push API calls
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: [{ status: 'ok', id: 'ticket-1' }] }),
});
vi.stubGlobal('fetch', mockFetch);

function setupTokenQuery(tokens: Array<{ token: string }>) {
  mockFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        eq: () => Promise.resolve({ data: tokens, error: null }),
      }),
    }),
    update: () => ({
      in: () => Promise.resolve({ error: null }),
    }),
  });
}

const { notifyNegotiationRequest, notifyNegotiationResponse } = await import(
  '@/lib/expo-push'
);

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('notifyNegotiationRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTokenQuery([{ token: 'ExponentPushToken[abc]' }]);
  });

  it('sends notification for single-item negotiation with item name', async () => {
    await notifyNegotiationRequest(
      'm1',
      'single',
      5000,
      'n1',
      'Nike Air Max',
      8000
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const sentPayload = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentPayload[0].title).toContain('Negotiation');
    expect(sentPayload[0].body).toContain('₦5,000');
    expect(sentPayload[0].body).toContain('Nike Air Max');
    expect(sentPayload[0].body).toContain('₦8,000');
    expect(sentPayload[0].data.negotiationId).toBe('n1');
    expect(sentPayload[0].data.type).toBe('negotiation_request');
    expect(sentPayload[0].channelId).toBe('orders');
  });

  it('uses fallback label when item name is null', async () => {
    await notifyNegotiationRequest('m1', 'single', 3000, 'n2', null, null);

    const sentPayload = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentPayload[0].body).toContain('an item');
    expect(sentPayload[0].body).not.toContain('listed at');
  });

  it('uses cart total label for total negotiation type', async () => {
    await notifyNegotiationRequest('m1', 'total', 15000, 'n3', null, 20000);

    const sentPayload = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentPayload[0].body).toContain('cart total');
  });

  it('does not call Expo API when merchant has no tokens', async () => {
    setupTokenQuery([]);

    await notifyNegotiationRequest('m1', 'single', 1000, 'n4', 'Shirt', null);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('notifyNegotiationResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTokenQuery([{ token: 'ExponentPushToken[xyz]' }]);
  });

  it('sends accepted notification with price', async () => {
    await notifyNegotiationResponse(
      'c1',
      'single',
      'accepted',
      'Blue Shirt',
      4500
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const sentPayload = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentPayload[0].title).toContain('Accepted');
    expect(sentPayload[0].body).toContain('₦4,500');
    expect(sentPayload[0].body).toContain('Blue Shirt');
    expect(sentPayload[0].data.type).toBe('negotiation_accepted');
    expect(sentPayload[0].channelId).toBe('orders');
  });

  it('sends rejected notification', async () => {
    await notifyNegotiationResponse(
      'c1',
      'single',
      'rejected',
      'Red Hat',
      null
    );

    const sentPayload = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentPayload[0].title).toContain('Declined');
    expect(sentPayload[0].body).toContain('Red Hat');
    expect(sentPayload[0].data.type).toBe('negotiation_rejected');
  });

  it('uses cart total label for total negotiation type', async () => {
    await notifyNegotiationResponse('c1', 'total', 'accepted', null, 10000);

    const sentPayload = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentPayload[0].body).toContain('cart total');
  });

  it('uses "your offer" when acceptedPrice is null on accepted', async () => {
    await notifyNegotiationResponse('c1', 'single', 'accepted', 'Item', null);

    const sentPayload = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentPayload[0].body).toContain('your offer');
  });
});

describe('error handling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handles Supabase query error gracefully', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () =>
            Promise.resolve({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    });

    // Should not throw
    await notifyNegotiationRequest('m1', 'single', 1000, 'n1', 'Item', null);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles Expo API failure gracefully', async () => {
    setupTokenQuery([{ token: 'ExponentPushToken[abc]' }]);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    // Should not throw
    await notifyNegotiationRequest('m1', 'single', 1000, 'n2', 'Item', null);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('deactivates tokens when Expo returns DeviceNotRegistered', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () =>
            Promise.resolve({
              data: [{ token: 'ExponentPushToken[dead]' }],
              error: null,
            }),
        }),
      }),
      update: mockUpdate,
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              status: 'error',
              message: 'Device not registered',
              details: { error: 'DeviceNotRegistered' },
            },
          ],
        }),
    });

    await notifyNegotiationRequest('m1', 'single', 1000, 'n3', 'Item', null);

    expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
  });
});
