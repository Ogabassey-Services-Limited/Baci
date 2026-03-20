import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockCreateClient = vi.fn();
const mockCookies = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookies()),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

function createRequest(method: 'DELETE' | 'PATCH'): NextRequest {
  return new Request('http://localhost/api/admin/notifications/123', {
    method,
    body:
      method === 'PATCH' ? JSON.stringify({ title: 'Updated title' }) : null,
    headers: method === 'PATCH' ? { 'Content-Type': 'application/json' } : {},
  }) as NextRequest;
}

function createMockSupabase(options?: {
  deleteError?: { message: string } | null;
  notification?: { id: string; sent_at: string | null } | null;
}) {
  const notification = options?.notification ?? {
    id: '123e4567-e89b-12d3-a456-426614174000',
    sent_at: null,
  };
  const deleteError = options?.deleteError ?? null;

  const merchantsQuery = {
    eq: vi.fn(() => merchantsQuery),
    maybeSingle: vi.fn(async () => ({
      data: { is_platform_admin: true },
      error: null,
    })),
    select: vi.fn(() => merchantsQuery),
  };

  const notificationsDeleteQuery = {
    eq: vi.fn(async () => ({
      error: deleteError,
    })),
  };

  const notificationsQuery = {
    delete: vi.fn(() => notificationsDeleteQuery),
    eq: vi.fn(() => notificationsQuery),
    single: vi.fn(async () => ({
      data: notification,
      error: notification ? null : { message: 'not found' },
    })),
    select: vi.fn(() => notificationsQuery),
    update: vi.fn(() => notificationsQuery),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return merchantsQuery;
      }

      if (table === 'notifications') {
        return notificationsQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

let mockSupabase = createMockSupabase();

import { DELETE, PATCH } from './route';

describe('/api/admin/notifications/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockReturnValue(new Map());
    mockSupabase = createMockSupabase();
    mockCreateAdminClient.mockReturnValue({});
    mockCreateClient.mockReturnValue(mockSupabase);
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: { isStaff: false },
    });
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
  });

  it('returns 403 when CSRF validation fails on PATCH', async () => {
    mockCheckCsrfProtection.mockResolvedValueOnce({
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
    });

    const response = await PATCH(createRequest('PATCH'), {
      params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Invalid CSRF token');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('returns 403 when CSRF validation fails on DELETE', async () => {
    mockCheckCsrfProtection.mockResolvedValueOnce({
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
    });

    const response = await DELETE(createRequest('DELETE'), {
      params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Invalid CSRF token');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('deletes notifications after passing CSRF validation', async () => {
    const response = await DELETE(createRequest('DELETE'), {
      params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      message: 'Scheduled notification cancelled',
      success: true,
    });
    expect(mockCreateClient).toHaveBeenCalled();
  });
});
