import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock expo-server-sdk
const mockSendPushNotificationsAsync = vi.fn();
const mockChunkPushNotifications = vi.fn((msgs: unknown[]) => [msgs]);
const mockChunkPushNotificationReceiptIds = vi.fn((ids: string[]) => [ids]);
const mockGetPushNotificationReceiptsAsync = vi.fn();

vi.mock('expo-server-sdk', () => {
  // Use a class so `new MockExpo()` survives vi.clearAllMocks()
  class MockExpo {
    sendPushNotificationsAsync = mockSendPushNotificationsAsync;
    chunkPushNotifications = mockChunkPushNotifications;
    chunkPushNotificationReceiptIds = mockChunkPushNotificationReceiptIds;
    getPushNotificationReceiptsAsync = mockGetPushNotificationReceiptsAsync;

    static isExpoPushToken(token: unknown): boolean {
      return (
        typeof token === 'string' && token.startsWith('ExponentPushToken[')
      );
    }
  }
  return { default: MockExpo, Expo: MockExpo };
});

// Mock Supabase admin client
function createChainableMock(
  returnData: unknown = [],
  returnError: unknown = null
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const terminal = () =>
    Promise.resolve({ data: returnData, error: returnError });

  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  // Supabase query builder returns thenables — Object.defineProperty avoids biome noThenProperty
  Object.defineProperty(chain, 'then', {
    value: (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown
    ) => terminal().then(resolve, reject),
    writable: true,
    configurable: true,
  });

  return chain;
}

vi.mock('@/env', () => ({
  getExpoAccessToken: () => 'test-expo-token',
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

import type { ExpoPushMessage } from 'expo-server-sdk';
import { createAdminClient } from '@/lib/supabase/admin';

// We'll import functions after mocks are set up
let sendPushNotification: typeof import('./expo-push').sendPushNotification;
let sendPushNotifications: typeof import('./expo-push').sendPushNotifications;
let notifyMerchant: typeof import('./expo-push').notifyMerchant;
let notifyCustomer: typeof import('./expo-push').notifyCustomer;
let notifyAdminUserDevices: typeof import('./expo-push').notifyAdminUserDevices;
let notifyNewOrder: typeof import('./expo-push').notifyNewOrder;
let notifyPaymentReceived: typeof import('./expo-push').notifyPaymentReceived;
let notifyLowStock: typeof import('./expo-push').notifyLowStock;
let notifyNewReview: typeof import('./expo-push').notifyNewReview;
beforeEach(async () => {
  vi.clearAllMocks();

  const mod = await import('./expo-push');
  sendPushNotification = mod.sendPushNotification;
  sendPushNotifications = mod.sendPushNotifications;
  notifyMerchant = mod.notifyMerchant;
  notifyCustomer = mod.notifyCustomer;
  notifyAdminUserDevices = mod.notifyAdminUserDevices;
  notifyNewOrder = mod.notifyNewOrder;
  notifyPaymentReceived = mod.notifyPaymentReceived;
  notifyLowStock = mod.notifyLowStock;
  notifyNewReview = mod.notifyNewReview;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// sendPushNotifications — SDK integration
// ---------------------------------------------------------------------------
describe('sendPushNotifications', () => {
  it('validates tokens with Expo.isExpoPushToken and skips invalid ones', async () => {
    const messages: ExpoPushMessage[] = [
      { to: 'ExponentPushToken[valid1]', body: 'Hello' },
      { to: 'invalid-token', body: 'Hello' },
      { to: 'ExponentPushToken[valid2]', body: 'World' },
    ];

    mockSendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'ok', id: 'ticket-1' },
      { status: 'ok', id: 'ticket-2' },
    ]);

    const tickets = await sendPushNotifications(messages);

    // Only valid tokens should be sent
    expect(mockChunkPushNotifications).toHaveBeenCalledWith([
      expect.objectContaining({ to: 'ExponentPushToken[valid1]' }),
      expect.objectContaining({ to: 'ExponentPushToken[valid2]' }),
    ]);

    // Invalid token should get an error ticket
    expect(tickets).toHaveLength(3);
    expect(tickets[1].status).toBe('error');
  });

  it('chunks messages and sends via SDK', async () => {
    const messages: ExpoPushMessage[] = [
      { to: 'ExponentPushToken[a]', body: 'Test' },
    ];

    mockChunkPushNotifications.mockReturnValueOnce([messages]);
    mockSendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'ok', id: 'ticket-abc' },
    ]);

    const tickets = await sendPushNotifications(messages);

    expect(mockChunkPushNotifications).toHaveBeenCalled();
    expect(mockSendPushNotificationsAsync).toHaveBeenCalledWith(messages);
    expect(tickets[0]).toEqual({ status: 'ok', id: 'ticket-abc' });
  });

  it('handles multiple chunks', async () => {
    const msg1: ExpoPushMessage = { to: 'ExponentPushToken[a]', body: 'A' };
    const msg2: ExpoPushMessage = { to: 'ExponentPushToken[b]', body: 'B' };

    mockChunkPushNotifications.mockReturnValueOnce([[msg1], [msg2]]);
    mockSendPushNotificationsAsync
      .mockResolvedValueOnce([{ status: 'ok', id: 't1' }])
      .mockResolvedValueOnce([{ status: 'ok', id: 't2' }]);

    const tickets = await sendPushNotifications([msg1, msg2]);

    expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(2);
    expect(tickets).toEqual([
      { status: 'ok', id: 't1' },
      { status: 'ok', id: 't2' },
    ]);
  });

  it('returns error tickets on SDK exception', async () => {
    const messages: ExpoPushMessage[] = [
      { to: 'ExponentPushToken[a]', body: 'Test' },
    ];

    mockChunkPushNotifications.mockReturnValueOnce([messages]);
    mockSendPushNotificationsAsync.mockRejectedValueOnce(
      new Error('Network failure')
    );

    const tickets = await sendPushNotifications(messages);

    expect(tickets).toHaveLength(1);
    expect(tickets[0].status).toBe('error');
    expect(tickets[0]).toHaveProperty('message', 'Network failure');
  });

  it('returns empty array for empty messages', async () => {
    const tickets = await sendPushNotifications([]);
    expect(tickets).toEqual([]);
    expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// sendPushNotification — single token
// ---------------------------------------------------------------------------
describe('sendPushNotification', () => {
  it('sends a single notification with correct defaults', async () => {
    mockSendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'ok', id: 'ticket-1' },
    ]);

    const ticket = await sendPushNotification(
      'ExponentPushToken[abc]',
      'Title',
      'Body text'
    );

    expect(mockChunkPushNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        to: 'ExponentPushToken[abc]',
        title: 'Title',
        body: 'Body text',
        sound: 'default',
        channelId: 'general',
        priority: 'default',
      }),
    ]);
    expect(ticket.status).toBe('ok');
  });

  it('uses high priority for orders channel', async () => {
    mockSendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'ok', id: 'ticket-2' },
    ]);

    await sendPushNotification(
      'ExponentPushToken[abc]',
      'Order',
      'New order',
      undefined,
      'orders'
    );

    expect(mockChunkPushNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        priority: 'high',
        channelId: 'orders',
      }),
    ]);
  });
});

// ---------------------------------------------------------------------------
// notifyMerchant — queries tokens with app_type='admin'
// ---------------------------------------------------------------------------
describe('notifyMerchant', () => {
  it('queries tokens filtered by merchant_id, is_active, and app_type=admin', async () => {
    const mockChain = createChainableMock([
      { token: 'ExponentPushToken[m1]' },
      { token: 'ExponentPushToken[m2]' },
    ]);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(mockChain),
    } as never);

    mockSendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'ok', id: 'ticket-1' },
      { status: 'ok', id: 'ticket-2' },
    ]);

    const result = await notifyMerchant('merchant-123', 'Test', 'Body');

    // Verify the query chain
    expect(mockChain.select).toHaveBeenCalledWith('token');
    expect(mockChain.eq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
    expect(mockChain.eq).toHaveBeenCalledWith('is_active', true);
    expect(mockChain.eq).toHaveBeenCalledWith('app_type', 'admin');

    expect(result).toEqual({ sent: 2, failed: 0, errors: [] });
  });

  it('returns zeros when no tokens found', async () => {
    const mockChain = createChainableMock([]);
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(mockChain),
    } as never);

    const result = await notifyMerchant('merchant-123', 'Test', 'Body');
    expect(result).toEqual({ sent: 0, failed: 0, errors: [] });
    expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('deactivates DeviceNotRegistered tokens', async () => {
    const updateChain = createChainableMock();
    const ticketInsertChain = createChainableMock();
    const attemptInsertChain = createChainableMock();
    const selectChain = createChainableMock([
      { token: 'ExponentPushToken[good]' },
      { token: 'ExponentPushToken[stale]' },
    ]);

    const mockFromFn = vi
      .fn()
      .mockReturnValueOnce(selectChain) // first call: select tokens
      .mockReturnValueOnce(updateChain) // second call: update to deactivate
      .mockReturnValueOnce(ticketInsertChain) // third call: store tickets
      .mockReturnValueOnce(attemptInsertChain); // fourth call: store attempt

    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFromFn,
    } as never);

    mockSendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'ok', id: 'ticket-1' },
      {
        status: 'error',
        message: 'Device not registered',
        details: { error: 'DeviceNotRegistered' },
      },
    ]);

    const result = await notifyMerchant('merchant-123', 'Test', 'Body');

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);

    // Should deactivate the stale token
    expect(updateChain.update).toHaveBeenCalledWith({ is_active: false });
    expect(updateChain.in).toHaveBeenCalledWith('token', [
      'ExponentPushToken[stale]',
    ]);
  });

  it('handles DB error when fetching tokens', async () => {
    const mockChain = createChainableMock(null, {
      message: 'DB connection failed',
    });
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(mockChain),
    } as never);

    const result = await notifyMerchant('merchant-123', 'Test', 'Body');
    expect(result).toEqual({
      sent: 0,
      failed: 0,
      errors: ['DB connection failed'],
    });
  });
});

// ---------------------------------------------------------------------------
// notifyCustomer — queries tokens with app_type='storefront'
// ---------------------------------------------------------------------------
describe('notifyCustomer', () => {
  it('queries tokens filtered by user_id, is_active, and app_type=storefront', async () => {
    const mockChain = createChainableMock([{ token: 'ExponentPushToken[c1]' }]);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(mockChain),
    } as never);

    mockSendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'ok', id: 'ticket-c1' },
    ]);

    const result = await notifyCustomer('user-456', 'Test', 'Body');

    expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-456');
    expect(mockChain.eq).toHaveBeenCalledWith('is_active', true);
    expect(mockChain.eq).toHaveBeenCalledWith('app_type', 'storefront');

    expect(result).toEqual({ sent: 1, failed: 0, errors: [] });
  });
});

describe('notifyAdminUserDevices', () => {
  it('queries only the authenticated admin user devices', async () => {
    const mockChain = createChainableMock([{ token: 'ExponentPushToken[a1]' }]);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(mockChain),
    } as never);

    mockSendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'ok', id: 'ticket-a1' },
    ]);

    const result = await notifyAdminUserDevices('user-123', 'Test', 'Body');

    expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(mockChain.eq).toHaveBeenCalledWith('is_active', true);
    expect(mockChain.eq).toHaveBeenCalledWith('app_type', 'admin');
    expect(result).toEqual({ sent: 1, failed: 0, errors: [] });
  });
});

// ---------------------------------------------------------------------------
// Event helpers
// ---------------------------------------------------------------------------
describe('notifyNewOrder', () => {
  it('sends order notification with formatted amount', async () => {
    const mockChain = createChainableMock([{ token: 'ExponentPushToken[m1]' }]);
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(mockChain),
    } as never);

    mockSendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'ok', id: 't1' },
    ]);

    await notifyNewOrder('merchant-1', 'order-1', 'ORD001', 'John Doe', 15000);

    const sentMessages = mockChunkPushNotifications.mock
      .calls[0][0] as ExpoPushMessage[];
    expect(sentMessages[0].title).toContain('New Order');
    expect(sentMessages[0].body).toContain('ORD001');
    expect(sentMessages[0].body).toContain('John Doe');
    expect(sentMessages[0].channelId).toBe('orders');
    expect(sentMessages[0].data).toEqual(
      expect.objectContaining({
        type: 'new_order',
        order_id: 'order-1',
        order_number: 'ORD001',
      })
    );
  });
});

describe('notifyPaymentReceived', () => {
  it('includes order number in body when provided', async () => {
    const mockChain = createChainableMock([{ token: 'ExponentPushToken[m1]' }]);
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(mockChain),
    } as never);

    mockSendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'ok', id: 't1' },
    ]);

    await notifyPaymentReceived('merchant-1', 5000, 'NGN', 'ORD002', 'order-2');

    const sentMessages = mockChunkPushNotifications.mock
      .calls[0][0] as ExpoPushMessage[];
    expect(sentMessages[0].body).toContain('ORD002');
    expect(sentMessages[0].channelId).toBe('payments');
    expect(sentMessages[0].data).toEqual(
      expect.objectContaining({
        type: 'payment_received',
        order_id: 'order-2',
        order_number: 'ORD002',
      })
    );
  });
});

describe('notifyLowStock', () => {
  it('includes product name and stock info', async () => {
    const mockChain = createChainableMock([{ token: 'ExponentPushToken[m1]' }]);
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(mockChain),
    } as never);

    mockSendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'ok', id: 't1' },
    ]);

    await notifyLowStock('merchant-1', 'product-1', 'Red Sneakers', 3, 10);

    const sentMessages = mockChunkPushNotifications.mock
      .calls[0][0] as ExpoPushMessage[];
    expect(sentMessages[0].body).toContain('Red Sneakers');
    expect(sentMessages[0].body).toContain('3');
    expect(sentMessages[0].channelId).toBe('stock');
    expect(sentMessages[0].data).toEqual(
      expect.objectContaining({
        type: 'low_stock',
        product_id: 'product-1',
        product_name: 'Red Sneakers',
      })
    );
  });
});

describe('notifyNewReview', () => {
  it('includes reviewer name and rating', async () => {
    const mockChain = createChainableMock([{ token: 'ExponentPushToken[m1]' }]);
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(mockChain),
    } as never);

    mockSendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'ok', id: 't1' },
    ]);

    await notifyNewReview('merchant-1', 'Blue Shirt', 5, 'Jane');

    const sentMessages = mockChunkPushNotifications.mock
      .calls[0][0] as ExpoPushMessage[];
    expect(sentMessages[0].body).toContain('Jane');
    expect(sentMessages[0].body).toContain('5');
    expect(sentMessages[0].body).toContain('Blue Shirt');
  });
});
