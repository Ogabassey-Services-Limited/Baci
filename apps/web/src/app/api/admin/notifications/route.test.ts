import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockChannel: vi.fn(),
  mockChannelSend: vi.fn(),
  mockCheckCsrfProtection: vi.fn(),
  mockFrom: vi.fn(),
  mockGetMerchantForApiRequest: vi.fn(),
  mockGetUser: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockNotificationInsert: vi.fn(),
  mockNotifyMerchant: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.mockCheckCsrfProtection,
}));

vi.mock('@/lib/expo-push', () => ({
  notifyMerchant: mocks.mockNotifyMerchant,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.mockGetMerchantForApiRequest,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: mocks.mockLoggerError,
    info: vi.fn(),
    warn: mocks.mockLoggerWarn,
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mocks.mockGetUser,
    },
    channel: mocks.mockChannel,
    from: mocks.mockFrom,
    removeChannel: mocks.mockRemoveChannel,
    rpc: mocks.mockRpc,
  })),
}));

import { POST } from './route';

const notification = {
  action_label: null,
  action_url: null,
  channels: ['in_app'],
  created_at: '2026-06-02T08:00:00.000Z',
  id: 'notification-1',
  message: 'This is a test notification',
  notification_type: 'info',
  priority: 'high',
  title: 'Test Notification',
};

function createRequest() {
  return new NextRequest('https://usebaci.com/api/admin/notifications', {
    body: JSON.stringify({
      channels: ['in_app'],
      message: 'This is a test notification',
      notification_type: 'info',
      priority: 'high',
      target_segment: 'new',
      target_type: 'segment',
      title: 'Test Notification',
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
}

function createNotificationInsertQuery() {
  return {
    insert: mocks.mockNotificationInsert.mockImplementation(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: notification, error: null }),
      })),
    })),
  };
}

function createMerchantsQuery(
  segmentResult: Promise<{
    data: Array<{ id: string }> | null;
    error: unknown;
  }>
) {
  return {
    select: vi.fn((columns: string) => {
      if (columns === 'is_platform_admin') {
        return {
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { is_platform_admin: true },
              error: null,
            }),
          })),
        };
      }

      if (columns === 'id') {
        return {
          gte: vi.fn(() => segmentResult),
        };
      }

      throw new Error(`Unexpected merchants select columns: ${columns}`);
    }),
  };
}

function mockSupabaseTables(
  segmentResult: Promise<{
    data: Array<{ id: string }> | null;
    error: unknown;
  }>
) {
  mocks.mockFrom.mockImplementation((table: string) => {
    if (table === 'merchants') {
      return createMerchantsQuery(segmentResult);
    }

    if (table === 'notifications') {
      return createNotificationInsertQuery();
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

describe('POST /api/admin/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mocks.mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mocks.mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-admin',
      staffAccess: { isStaff: false },
    });
    mocks.mockNotificationInsert.mockImplementation(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: notification, error: null }),
      })),
    }));
    mocks.mockRpc.mockResolvedValue({ data: 1, error: null });
    mocks.mockChannel.mockReturnValue({ send: mocks.mockChannelSend });
    mocks.mockChannelSend.mockResolvedValue('ok');
    mocks.mockRemoveChannel.mockResolvedValue(undefined);
  });

  it('returns 500 and does not broadcast when immediate segment lookup fails', async () => {
    mockSupabaseTables(
      Promise.resolve({ data: null, error: { message: 'Database error' } })
    );

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to create notification' });
    expect(mocks.mockNotificationInsert).not.toHaveBeenCalled();
    expect(mocks.mockRpc).not.toHaveBeenCalled();
    expect(mocks.mockChannel).not.toHaveBeenCalled();
    expect(mocks.mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Error fetching segment merchants',
        segment: 'new',
      })
    );
  });

  it('creates and sends an immediate segment notification when lookup succeeds', async () => {
    mockSupabaseTables(
      Promise.resolve({ data: [{ id: 'merchant-1' }], error: null })
    );

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      merchants_notified: 1,
      notification,
      status: 'sent',
    });
    expect(mocks.mockRpc).toHaveBeenCalledWith(
      'send_notification_to_merchants',
      {
        p_merchant_ids: ['merchant-1'],
        p_notification_id: 'notification-1',
      }
    );
    expect(mocks.mockChannelSend).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'new_notification',
        type: 'broadcast',
      })
    );
  });
});
