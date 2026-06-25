import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { PATCH } from './route';

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
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

function createRequest(
  body: Record<string, unknown> = { title: 'Updated title' }
): NextRequest {
  return new Request('http://localhost/api/admin/notifications/123', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as NextRequest;
}

function createMockSupabase(options?: {
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

  const merchantsQuery = {
    eq: vi.fn(() => merchantsQuery),
    maybeSingle: vi.fn(async () => ({
      data: { is_platform_admin: true },
      error: null,
    })),
    select: vi.fn(() => merchantsQuery),
  };

  const notificationsQuery = {
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
      if (table === 'merchants') return merchantsQuery;
      if (table === 'notifications') return notificationsQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('PATCH /api/admin/notifications/[id]', () => {
  let mockSupabase = createMockSupabase();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCookies.mockReturnValue(new Map());
    mockCreateClient.mockReturnValue(mockSupabase);
    (
      getMerchantForApiRequest as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: { isStaff: false },
    });
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
  });

  it('returns 403 when CSRF validation fails', async () => {
    mockCheckCsrfProtection.mockResolvedValueOnce({
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
    });

    const response = await PATCH(createRequest(), {
      params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Invalid CSRF token');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects updates that would leave specific targeting without merchants', async () => {
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

    const response = await PATCH(createRequest({ target_merchant_ids: [] }), {
      params: Promise.resolve({
        id: '123e4567-e89b-12d3-a456-426614174000',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid input');
    expect(body.details.fieldErrors.target_merchant_ids).toContain(
      'Target merchant IDs required for specific targeting'
    );
  });

  it('accepts partial targeting when stored merchant IDs remain valid', async () => {
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

    const response = await PATCH(createRequest({ target_type: 'specific' }), {
      params: Promise.resolve({
        id: '123e4567-e89b-12d3-a456-426614174000',
      }),
    });

    expect(response.status).toBe(200);
  });
});
