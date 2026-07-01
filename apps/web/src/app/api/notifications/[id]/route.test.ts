import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { GET, PATCH } from './route';

interface MockSupabaseClient {
  auth: {
    getUser: Mock;
  };
  from: Mock;
  select: Mock;
  eq: Mock;
  single: Mock;
  update: Mock;
  is: Mock;
}

vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(),
      set: vi.fn(),
      getAll: vi.fn(),
    })
  ),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(),
  toUserAccess: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: vi.fn().mockReturnValue(true),
}));

describe('Notifications API: /api/notifications/[id]', () => {
  let mockSupabase: MockSupabaseClient;
  const mockUserId = 'user-123';
  const mockMerchantId = 'merchant-456';

  beforeEach(() => {
    vi.clearAllMocks();

    const mockIs2 = vi.fn();
    const mockIs1 = vi.fn().mockReturnValue({ is: mockIs2 });

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
      is: mockIs1,
    };

    mockIs2.mockResolvedValue({ count: 5, error: null });

    vi.mocked(createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof createClient>
    );

    vi.mocked(getMerchantForApiRequest).mockResolvedValue({
      merchantId: mockMerchantId,
      merchantSlug: 'test',
      businessName: 'Test',
      staffAccess: {},
      roles: ['owner'],
    } as unknown as Awaited<ReturnType<typeof getMerchantForApiRequest>>);

    vi.mocked(toUserAccess).mockReturnValue({
      role: 'owner',
    } as unknown as ReturnType<typeof toUserAccess>);

    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: true,
    } as unknown as Awaited<ReturnType<typeof checkCsrfProtection>>);

    vi.mocked(hasPermission).mockReturnValue(true);
  });

  describe('GET', () => {
    it('returns 401 when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const req = new NextRequest('http://localhost/api/notifications/123');
      const res = await GET(req, { params: Promise.resolve({ id: '123' }) });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ error: 'Unauthorized' });
    });

    it('returns 403 when user lacks permissions', async () => {
      vi.mocked(hasPermission).mockReturnValueOnce(false);

      const req = new NextRequest('http://localhost/api/notifications/123');
      const res = await GET(req, { params: Promise.resolve({ id: '123' }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json).toEqual({ error: 'Permission denied' });
    });

    it('returns 404 when notification not found', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const req = new NextRequest('http://localhost/api/notifications/123');
      const res = await GET(req, { params: Promise.resolve({ id: '123' }) });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json).toEqual({ error: 'Notification not found' });
    });

    it('returns 200 and notification data on success', async () => {
      const mockNotification = { id: '123', title: 'Test Notif' };
      mockSupabase.single.mockResolvedValueOnce({
        data: mockNotification,
        error: null,
      });

      const req = new NextRequest('http://localhost/api/notifications/123');
      const res = await GET(req, { params: Promise.resolve({ id: '123' }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual(mockNotification);

      expect(mockSupabase.from).toHaveBeenCalledWith('merchant_notifications');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '123');
      expect(mockSupabase.eq).toHaveBeenCalledWith(
        'merchant_id',
        mockMerchantId
      );
    });
  });

  describe('PATCH', () => {
    it('returns 403 when CSRF validation fails', async () => {
      vi.mocked(checkCsrfProtection).mockResolvedValueOnce({
        valid: false,
      } as unknown as Awaited<ReturnType<typeof checkCsrfProtection>>);

      const req = new NextRequest('http://localhost/api/notifications/123', {
        method: 'PATCH',
        body: JSON.stringify({ read: true }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: '123' }) });

      expect(res.status).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const req = new NextRequest('http://localhost/api/notifications/123', {
        method: 'PATCH',
        body: JSON.stringify({ read: true }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: '123' }) });

      expect(res.status).toBe(401);
    });

    it('returns 403 when user lacks permissions', async () => {
      vi.mocked(hasPermission).mockReturnValueOnce(false);

      const req = new NextRequest('http://localhost/api/notifications/123', {
        method: 'PATCH',
        body: JSON.stringify({ read: true }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: '123' }) });

      expect(res.status).toBe(403);
    });

    it('returns 400 when no fields provided to update', async () => {
      const req = new NextRequest('http://localhost/api/notifications/123', {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: '123' }) });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toEqual({ error: 'No fields to update' });
    });

    it('returns 200 and updates read status successfully', async () => {
      const mockUpdated = { id: '123', read_at: '2023-01-01T00:00:00.000Z' };

      mockSupabase.single.mockResolvedValueOnce({
        data: mockUpdated,
        error: null,
      });

      const req = new NextRequest('http://localhost/api/notifications/123', {
        method: 'PATCH',
        body: JSON.stringify({ read: true }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: '123' }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ ...mockUpdated, unread_count: 5 });

      expect(mockSupabase.update).toHaveBeenCalled();
      expect(mockSupabase.update.mock.calls[0][0]).toHaveProperty('read_at');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '123');
    });

    it('returns 500 when database update fails', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB Error' },
      });

      const req = new NextRequest('http://localhost/api/notifications/123', {
        method: 'PATCH',
        body: JSON.stringify({ dismissed: true }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: '123' }) });

      expect(res.status).toBe(500);
    });
  });
});
