import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { GET, PUT } from './route';

// Mock dependencies
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('Admin Settings API', () => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  };

  const mockMerchantContext = {
    merchantId: 'test-merchant-id',
    staffAccess: { isStaff: false },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (cookies as any).mockResolvedValue({});
    (createClient as any).mockReturnValue(mockSupabase);

    // Default mock setup for successful auth
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    (getMerchantForApiRequest as any).mockResolvedValue(mockMerchantContext);

    // Default mock setup for admin check
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { is_platform_admin: true },
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'settings-id', platform_name: 'Updated Name' },
        error: null,
      }),
    });
  });

  describe('PUT /api/admin/settings', () => {
    it('should reject requests that fail CSRF validation', async () => {
      // Mock CSRF failure
      const mockResponse = NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      );
      (checkCsrfProtection as any).mockResolvedValue({
        valid: false,
        response: mockResponse,
      });

      const request = {
        method: 'PUT',
        json: vi.fn().mockResolvedValue({ platform_name: 'Test' }),
      } as unknown as NextRequest;

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('CSRF validation failed');
      expect(checkCsrfProtection).toHaveBeenCalledWith(request);

      // Ensure business logic is not executed
      expect(createClient).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated requests', async () => {
      (checkCsrfProtection as any).mockResolvedValue({ valid: true });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = {
        method: 'PUT',
        json: vi.fn().mockResolvedValue({ platform_name: 'Test' }),
      } as unknown as NextRequest;

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject requests from non-platform admins', async () => {
      (checkCsrfProtection as any).mockResolvedValue({ valid: true });
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { is_platform_admin: false },
        }),
      });

      const request = {
        method: 'PUT',
        json: vi.fn().mockResolvedValue({ platform_name: 'Test' }),
      } as unknown as NextRequest;

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden - Platform admin access required');
    });

    it('should reject requests with invalid numeric fields', async () => {
      (checkCsrfProtection as any).mockResolvedValue({ valid: true });

      const request = {
        method: 'PUT',
        json: vi.fn().mockResolvedValue({ platform_fee_percentage: -1 }), // Invalid negative fee
      } as unknown as NextRequest;

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('platform_fee_percentage must be a non-negative number');
    });

    it('should successfully update settings with valid payload', async () => {
      (checkCsrfProtection as any).mockResolvedValue({ valid: true });

      const payload = {
        platform_name: 'New Platform Name',
        platform_fee_percentage: 5,
        enable_merchant_signups: false,
      };

      const request = {
        method: 'PUT',
        json: vi.fn().mockResolvedValue(payload),
      } as unknown as NextRequest;

      const mockUpdateChain = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...payload, id: 'settings-id' },
          error: null,
        }),
      };

      // We need to carefully mock the supabase.from chain since 'from' is called twice:
      // once for the admin check (merchants table), once for the update (platform_settings table)
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
        if (table === 'platform_settings') {
          return {
            update: vi.fn().mockReturnValue(mockUpdateChain),
          };
        }
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ ...payload, id: 'settings-id' });
    });

    it('should handle database errors gracefully', async () => {
      (checkCsrfProtection as any).mockResolvedValue({ valid: true });

      const request = {
        method: 'PUT',
        json: vi.fn().mockResolvedValue({ platform_name: 'Test' }),
      } as unknown as NextRequest;

      const mockUpdateChain = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('DB Error'),
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { is_platform_admin: true },
            }),
          };
        }
        if (table === 'platform_settings') {
          return {
            update: vi.fn().mockReturnValue(mockUpdateChain),
          };
        }
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update settings');
    });
  });
});
