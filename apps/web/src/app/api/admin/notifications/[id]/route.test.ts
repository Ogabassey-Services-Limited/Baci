import { cookies } from 'next/headers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { GET } from './route';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
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
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('GET /api/admin/notifications/[id]', () => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  };

  const mockAdminSupabase = {
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1042);

    (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSupabase
    );
    (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      mockAdminSupabase
    );
    (
      getMerchantForApiRequest as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: { isStaff: false },
    });

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { is_platform_admin: true },
            error: null,
          }),
        };
      }

      if (table === 'notifications') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              title: 'Launch update',
            },
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const totalChain = {
      eq: vi.fn().mockResolvedValue({ count: 12, error: null }),
    };

    const readChain = {
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ count: 5, error: null }),
    };

    mockAdminSupabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue(totalChain),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue(readChain),
      });
  });

  it('logs timing telemetry around the parallel stats query', async () => {
    const response = await GET({} as Request, {
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
});
