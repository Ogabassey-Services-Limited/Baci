import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookies = vi.fn();
const mockCreateClient = vi.fn();
const mockCheckCsrfProtection = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();

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

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

const settingsUrl = 'http://localhost/api/admin/settings';

function createRequest(body: unknown): NextRequest {
  return new NextRequest(settingsUrl, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'PUT',
  });
}

function createMockCookieStore() {
  return {
    get: vi.fn(
      (_name: string) =>
        undefined as { name: string; value: string } | undefined
    ),
    getAll: vi.fn(() => [] as Array<{ name: string; value: string }>),
    has: vi.fn((_name: string) => false),
  };
}

function createMockSupabase(options?: {
  unauthenticated?: boolean;
  isPlatformAdmin?: boolean;
  updateError?: { message: string } | null;
}) {
  const merchantsBuilder = {
    eq: vi.fn(() => merchantsBuilder),
    maybeSingle: vi.fn(async () => ({
      data: { is_platform_admin: options?.isPlatformAdmin ?? true },
      error: null,
    })),
    select: vi.fn(() => merchantsBuilder),
  };

  const updateBuilder = {
    eq: vi.fn(() => updateBuilder),
    select: vi.fn(() => updateBuilder),
    single: vi.fn(async () => ({
      data:
        options?.updateError == null
          ? { id: 'settings-1', platform_name: 'Baci' }
          : null,
      error: options?.updateError ?? null,
    })),
  };

  const platformSettingsBuilder = {
    update: vi.fn(() => updateBuilder),
  };

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options?.unauthenticated ? null : { id: 'user-1' } },
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return merchantsBuilder;
      }
      if (table === 'platform_settings') {
        return platformSettingsBuilder;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    __mocks: {
      platformSettingsBuilder,
      updateBuilder,
    },
  };
}

import { PUT } from './route';

describe('PUT /api/admin/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockReturnValue(createMockCookieStore());
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: { isStaff: false },
    });
  });

  it('returns CSRF rejection response when validation fails', async () => {
    const csrfResponse = NextResponse.json(
      { error: 'CSRF token invalid' },
      { status: 403 }
    );
    mockCheckCsrfProtection.mockResolvedValueOnce({
      valid: false,
      response: csrfResponse,
    });

    const response = await PUT(createRequest({ platform_name: 'Baci' }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('CSRF token invalid');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('updates platform settings for authorized platform admin', async () => {
    const mockSupabase = createMockSupabase();
    mockCreateClient.mockReturnValue(mockSupabase);

    const response = await PUT(
      createRequest({
        enable_custom_domains: true,
        platform_name: 'Baci Prime',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ id: 'settings-1', platform_name: 'Baci' });
    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith(
      mockSupabase,
      'user-1'
    );
    expect(mockSupabase.from).toHaveBeenCalledWith('platform_settings');
    expect(
      mockSupabase.__mocks.platformSettingsBuilder.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        enable_custom_domains: true,
        platform_name: 'Baci Prime',
      })
    );
  });

  it('returns 500 when updating settings fails', async () => {
    const mockSupabase = createMockSupabase({
      updateError: { message: 'update failed' },
    });
    mockCreateClient.mockReturnValue(mockSupabase);

    const response = await PUT(createRequest({ platform_name: 'Baci' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to update settings');
  });

  it('returns 401 when user is not authenticated', async () => {
    const mockSupabase = createMockSupabase({ unauthenticated: true });
    mockCreateClient.mockReturnValue(mockSupabase);

    const response = await PUT(createRequest({ platform_name: 'Baci' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(
      mockSupabase.__mocks.platformSettingsBuilder.update
    ).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not a platform admin', async () => {
    const mockSupabase = createMockSupabase({ isPlatformAdmin: false });
    mockCreateClient.mockReturnValue(mockSupabase);

    const response = await PUT(createRequest({ platform_name: 'Baci' }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden - Platform admin access required');
    expect(
      mockSupabase.__mocks.platformSettingsBuilder.update
    ).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid request payload', async () => {
    const mockSupabase = createMockSupabase();
    mockCreateClient.mockReturnValue(mockSupabase);

    const response = await PUT(
      createRequest({ support_email: 'not-an-email' })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request payload');
    expect(
      mockSupabase.__mocks.platformSettingsBuilder.update
    ).not.toHaveBeenCalled();
  });
});
