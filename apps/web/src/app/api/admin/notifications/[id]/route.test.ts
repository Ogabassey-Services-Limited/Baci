import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { logger } from '@/lib/logger';
import { DELETE, GET, PATCH } from './route';

const mockCreateAdminClient = vi.fn();
const mockCreateClient = vi.fn();
const mockCookies = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookies()),
}));

const mockCheckCsrfProtection = vi.fn();
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

function createRequest(
  method: 'DELETE' | 'PATCH',
  body: Record<string, unknown> = { title: 'Updated title' }
): NextRequest {
  return new Request('http://localhost/api/admin/notifications/123', {
    method,
    body: method === 'PATCH' ? JSON.stringify(body) : null,
    headers: method === 'PATCH' ? { 'Content-Type': 'application/json' } : {},
  }) as NextRequest;
}

function createMockSupabase(options?: {
  deleteError?: { message: string } | null;
  notification?: {
    id: string;
    sent_at: string | null;
    target_merchant_ids?: string[] | null;
    target_segment?: string | null;
    target_type?: string;
    title?: string;
  } | null;
}) {
  const notification = options?.notification ?? {
    id: '123e4567-e89b-12d3-a456-426614174000',
    sent_at: null,
    target_merchant_ids: null,
    target_segment: null,
    target_type: 'all',
    title: 'Launch update',
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

function createMockAdminSupabase(options?: {
  totalCount?: number | null;
  totalError?: { message: string } | null;
  readCount?: number | null;
  readError?: { message: string } | null;
}) {
  const totalChain = {
    eq: vi.fn().mockResolvedValue({
      count: options?.totalCount === undefined ? 12 : options.totalCount,
      error: options?.totalError ?? null,
    }),
  };

  const readChain = {
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockResolvedValue({
      count: options?.readCount === undefined ? 5 : options.readCount,
      error: options?.readError ?? null,
    }),
  };

  return {
    from: vi
      .fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue(totalChain),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue(readChain),
      }),
  };
}

describe('/api/admin/notifications/[id]', () => {
  let mockSupabase = createMockSupabase();
  let mockAdminSupabase = createMockAdminSupabase();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1042);
    mockSupabase = createMockSupabase();
    mockAdminSupabase = createMockAdminSupabase();
    mockCookies.mockReturnValue(new Map());
    mockCreateClient.mockReturnValue(mockSupabase);
    mockCreateAdminClient.mockReturnValue(mockAdminSupabase);
    (
      getMerchantForApiRequest as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: { isStaff: false },
    });
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
  });

  it('logs timing telemetry around the parallel stats query', async () => {
    const response = await GET({} as unknown as NextRequest, {
      params: Promise.resolve({
        id: '123e4567-e89b-12d3-a456-426614174000',
      }),
    });

    expect(response.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith({
      message: 'notification_stats_query_ms',
      notification_id: '123e4567-e89b-12d3-a456-426614174000',
      duration_ms: 42,
      success: true,
      total_error: false,
      read_error: false,
    });

    await expect(response.json()).resolves.toMatchObject({
      id: '123e4567-e89b-12d3-a456-426614174000',
      stats: {
        total_recipients: 12,
        read_count: 5,
      },
    });
  });

  it('logs failure flags and falls back counts when a stats query errors', async () => {
    mockAdminSupabase = createMockAdminSupabase({
      totalCount: null,
      totalError: { message: 'boom' },
    });
    mockCreateAdminClient.mockReturnValue(mockAdminSupabase);

    const response = await GET({} as unknown as NextRequest, {
      params: Promise.resolve({
        id: '123e4567-e89b-12d3-a456-426614174000',
      }),
    });

    expect(response.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith({
      message: 'notification_stats_query_ms',
      notification_id: '123e4567-e89b-12d3-a456-426614174000',
      duration_ms: 42,
      success: false,
      total_error: true,
      read_error: false,
    });

    await expect(response.json()).resolves.toMatchObject({
      id: '123e4567-e89b-12d3-a456-426614174000',
      stats: {
        total_recipients: 0,
        read_count: 5,
      },
    });
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

  it('rejects PATCH updates that would leave specific targeting without merchants', async () => {
    mockSupabase = createMockSupabase({
      notification: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        sent_at: null,
        target_merchant_ids: ['123e4567-e89b-12d3-a456-426614174111'],
        target_segment: null,
        target_type: 'specific',
        title: 'Launch update',
      },
    });
    mockCreateClient.mockReturnValue(mockSupabase);

    const response = await PATCH(
      createRequest('PATCH', { target_merchant_ids: [] }),
      {
        params: Promise.resolve({
          id: '123e4567-e89b-12d3-a456-426614174000',
        }),
      }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid input');
    expect(body.details.fieldErrors.target_merchant_ids).toContain(
      'Target merchant IDs required for specific targeting'
    );
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
