import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => {
  return {
    getMerchantForApiRequest: vi
      .fn()
      .mockResolvedValue({
        merchantId: 'test-merchant',
        staffAccess: { isStaff: false },
      }),
  };
});

vi.mock('@/lib/supabase/server', () => {
  return {
    createClient: vi.fn().mockReturnValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: 'test-user' } } }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { is_platform_admin: true } }),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { is_platform_admin: true } }),
      insert: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      rpc: vi.fn().mockResolvedValue({ data: 1 }),
      channel: vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue('ok'),
      }),
      removeChannel: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

describe('POST /api/admin/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not create a sent notification when immediate segment lookup fails', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    const mockSupabase = createClient() as any;

    // Override the query behavior for segment lookup to throw an error
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'notifications') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'notif-123', channels: ['in_app'] },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'merchants') {
        // The mock needs to return an object where `select` is chained correctly
        // `supabase.from('merchants').select('id')` OR `.select('is_platform_admin')`
        return {
          select: vi.fn().mockImplementation((columns: string) => {
            if (columns === 'is_platform_admin') {
              return {
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: { is_platform_admin: true } }),
                }),
              };
            }
            // It's the `select('id')` query
            return {
              gte: vi
                .fn()
                .mockResolvedValue({
                  data: null,
                  error: { message: 'Database error' },
                }),
            };
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: { is_platform_admin: true } }),
        single: vi
          .fn()
          .mockResolvedValue({ data: { is_platform_admin: true } }),
      };
    });

    const req = new NextRequest('http://localhost/api/admin/notifications', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Notification',
        message: 'This is a test notification',
        notification_type: 'info',
        priority: 'high',
        target_type: 'segment',
        target_segment: 'new',
        channels: ['in_app'],
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(req);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to create notification');
  });

  it('creates and sends notification on successful segment lookup', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    const mockSupabase = createClient() as any;

    // Mock the insertion to return a notification object
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'notifications') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'notif-123', channels: ['in_app'] },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'merchants') {
        return {
          select: vi.fn().mockImplementation((columns: string) => {
            if (columns === 'is_platform_admin') {
              return {
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: { is_platform_admin: true } }),
                }),
              };
            }
            // It's the `select('id')` query
            return {
              gte: vi
                .fn()
                .mockResolvedValue({ data: [{ id: 'merch-1' }], error: null }),
            };
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: { is_platform_admin: true } }),
        single: vi
          .fn()
          .mockResolvedValue({ data: { is_platform_admin: true } }),
      };
    });

    const req = new NextRequest('http://localhost/api/admin/notifications', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Notification',
        message: 'This is a test notification',
        notification_type: 'info',
        priority: 'high',
        target_type: 'segment',
        target_segment: 'new',
        channels: ['in_app'],
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(req);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.status).toBe('sent');
    expect(data.merchants_notified).toBe(1);
  });
});
