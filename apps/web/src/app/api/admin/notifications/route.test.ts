import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCheckCsrfProtection,
  mockCreateClient,
  mockGetMerchantForApiRequest,
} = vi.hoisted(() => ({
  mockCheckCsrfProtection: vi.fn(),
  mockCreateClient: vi.fn(),
  mockGetMerchantForApiRequest: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyMerchant: vi.fn(),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import { logger } from '@/lib/logger';
import { POST } from './route';

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

function createRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }) as NextRequest;
}

function createAdminCheckQuery() {
  const query = {
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({
      data: { is_platform_admin: true },
      error: null,
    })),
    select: vi.fn(() => query),
  };

  return query;
}

function createSegmentQuery(result: QueryResult<Array<{ id: string }>>) {
  const query = {
    gte: vi.fn(async () => result),
    select: vi.fn(() => query),
  };

  return query;
}

function createMockSupabase(options?: {
  segmentResult?: QueryResult<Array<{ id: string }>>;
}) {
  const createdNotification = {
    id: 'notification-1',
    title: segmentNotificationBody.title,
    message: segmentNotificationBody.message,
    notification_type: segmentNotificationBody.notification_type,
    priority: segmentNotificationBody.priority,
    target_type: segmentNotificationBody.target_type,
    target_merchant_ids: [],
    target_segment: segmentNotificationBody.target_segment,
    channels: segmentNotificationBody.channels,
    action_url: null,
    action_label: null,
    scheduled_for: null,
    created_by: 'user-1',
    created_at: '2026-06-01T00:00:00.000Z',
  };
  const notificationSingle = vi.fn(async () => ({
    data: createdNotification,
    error: null,
  }));
  const notificationSelect = vi.fn(() => ({
    single: notificationSingle,
  }));
  const notificationInsert = vi.fn(() => ({
    select: notificationSelect,
  }));
  const adminCheckQuery = createAdminCheckQuery();
  const segmentQuery = createSegmentQuery(
    options?.segmentResult ?? {
      data: [{ id: 'merchant-target-1' }],
      error: null,
    }
  );
  const notificationChannel = {
    send: vi.fn(async () => 'ok'),
  };
  let merchantQueryCount = 0;

  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        merchantQueryCount += 1;
        return merchantQueryCount === 1 ? adminCheckQuery : segmentQuery;
      }

      if (table === 'notifications') {
        return {
          insert: notificationInsert,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    channel: vi.fn(() => notificationChannel),
    notificationInsert,
    notificationSelect,
    notificationSingle,
    removeChannel: vi.fn(async () => undefined),
    rpc: vi.fn(async () => ({
      data: 2,
      error: null,
    })),
    notificationChannel,
  };

  return supabase;
}

const segmentNotificationBody = {
  title: 'Merchant update',
  message: 'New compliance update is available',
  notification_type: 'info',
  priority: 'normal',
  target_type: 'segment',
  target_segment: 'new',
  channels: ['in_app'],
};

describe('/api/admin/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'admin-merchant-1',
      staffAccess: { isStaff: false },
    });
  });

  it('does not create a sent notification when immediate segment lookup fails', async () => {
    const supabase = createMockSupabase({
      segmentResult: {
        data: null,
        error: { message: 'segment query failed' },
      },
    });
    mockCreateClient.mockReturnValue(supabase);

    const response = await POST(createRequest(segmentNotificationBody));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to create notification');
    expect(supabase.notificationInsert).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Error fetching segment merchants',
        segment: 'new',
      })
    );
  });

  it('creates and sends an immediate segment notification when lookup succeeds', async () => {
    const supabase = createMockSupabase({
      segmentResult: {
        data: [{ id: 'merchant-target-1' }, { id: 'merchant-target-2' }],
        error: null,
      },
    });
    mockCreateClient.mockReturnValue(supabase);

    const response = await POST(createRequest(segmentNotificationBody));
    const body = (await response.json()) as {
      merchants_notified: number;
      notification: { id: string; target_segment: string };
      status: string;
    };

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      merchants_notified: 2,
      notification: {
        id: 'notification-1',
        target_segment: 'new',
      },
      status: 'sent',
    });
    expect(supabase.notificationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        created_by: 'user-1',
        message: segmentNotificationBody.message,
        sent_at: expect.any(String),
        target_segment: 'new',
        target_type: 'segment',
        title: segmentNotificationBody.title,
      })
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'send_notification_to_merchants',
      {
        p_merchant_ids: ['merchant-target-1', 'merchant-target-2'],
        p_notification_id: 'notification-1',
      }
    );
    expect(supabase.channel).toHaveBeenCalledWith('notifications:global');
    expect(supabase.notificationChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'new_notification',
        payload: expect.objectContaining({
          target_merchant_ids: ['merchant-target-1', 'merchant-target-2'],
        }),
        type: 'broadcast',
      })
    );
    expect(supabase.removeChannel).toHaveBeenCalledWith(
      supabase.notificationChannel
    );
  });
});
