import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLATFORM_SETTINGS_SELECT } from './constants';
import type { PlatformSettings, PlatformSettingsResponse } from './route';

const {
  mockCheckCsrfProtection,
  mockGetMerchantForApiRequest,
  mockCreateClient,
} = vi.hoisted(() => ({
  mockCheckCsrfProtection: vi.fn(),
  mockGetMerchantForApiRequest: vi.fn(),
  mockCreateClient: vi.fn(),
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

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import { GET, PUT } from './route';

const baseSettings = {
  id: 'settings-1',
  google_analytics_id: 'G-123456',
  ga4_api_secret: 'ga4-secret',
  facebook_pixel_id: null,
  facebook_capi_token: 'fb-secret',
  tiktok_pixel_id: null,
  tiktok_access_token: null,
  snapchat_pixel_id: null,
  snapchat_capi_token: 'snap-secret',
  twitter_pixel_id: null,
  platform_fee_percentage: 2.5,
  platform_fee_flat: 100,
  payment_processor_fee_percentage: 1.5,
  payment_processor_fee_flat: 75,
  platform_name: 'Baci',
  platform_logo_url: null,
  support_email: 'support@baci.app',
  support_phone: null,
  enable_merchant_signups: true,
  enable_custom_domains: true,
  enable_analytics_export: false,
  maintenance_mode: false,
  maintenance_message: null,
  created_at: '2026-03-17T00:00:00.000Z',
  updated_at: '2026-03-17T00:00:00.000Z',
} satisfies PlatformSettings;

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type MerchantContext = {
  merchantId: string;
  staffAccess: {
    isStaff: boolean;
  };
};

let authUser: { id: string } | null = { id: 'user-1' };
let merchantContext: MerchantContext | null = {
  merchantId: 'merchant-1',
  staffAccess: {
    isStaff: false,
  },
};
let merchantAdminResult: QueryResult<{ is_platform_admin: boolean }> = {
  data: { is_platform_admin: true },
  error: null,
};
let platformSettingsResult: QueryResult<PlatformSettings> = {
  data: baseSettings,
  error: null,
};
let capturedMerchantSelect: string | null = null;
let capturedPlatformSettingsSelect: string | null = null;
let capturedPlatformSettingsUpdate: Record<string, unknown> | null = null;

function createMerchantsQuery() {
  const query = {
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => merchantAdminResult),
    select: vi.fn((columns?: string) => {
      capturedMerchantSelect = columns ?? null;
      return query;
    }),
  };

  return query;
}

function createPlatformSettingsQuery() {
  const query = {
    eq: vi.fn(() => query),
    select: vi.fn((columns?: string) => {
      capturedPlatformSettingsSelect = columns ?? null;
      return query;
    }),
    single: vi.fn(async () => platformSettingsResult),
    update: vi.fn((data: Record<string, unknown>) => {
      capturedPlatformSettingsUpdate = data;
      return query;
    }),
  };

  return query;
}

function createMockSupabase() {
  const merchantsQuery = createMerchantsQuery();
  const platformSettingsQuery = createPlatformSettingsQuery();

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: authUser },
        error: authUser ? null : { message: 'Not authenticated' },
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return merchantsQuery;
      }

      if (table === 'platform_settings') {
        return platformSettingsQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createPutRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('/api/admin/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser = { id: 'user-1' };
    merchantContext = {
      merchantId: 'merchant-1',
      staffAccess: {
        isStaff: false,
      },
    };
    merchantAdminResult = {
      data: { is_platform_admin: true },
      error: null,
    };
    platformSettingsResult = {
      data: baseSettings,
      error: null,
    };
    capturedMerchantSelect = null;
    capturedPlatformSettingsSelect = null;
    capturedPlatformSettingsUpdate = null;
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockGetMerchantForApiRequest.mockResolvedValue(merchantContext);
    mockCreateClient.mockReturnValue(createMockSupabase());
  });

  it('returns platform settings with explicit columns', async () => {
    const response = await GET();
    const body = (await response.json()) as PlatformSettingsResponse;

    expect(response.status).toBe(200);
    expect(body.id).toBe(baseSettings.id);
    expect(body.secretStatus).toEqual({
      ga4_api_secret: true,
      facebook_capi_token: true,
      tiktok_access_token: false,
      snapchat_capi_token: true,
    });
    expect(body).not.toHaveProperty('ga4_api_secret');
    expect(body).not.toHaveProperty('facebook_capi_token');
    expect(capturedMerchantSelect).toBe('is_platform_admin');
    expect(capturedPlatformSettingsSelect).toBe(PLATFORM_SETTINGS_SELECT);
  });

  it('returns 500 when fetching platform settings fails', async () => {
    platformSettingsResult = {
      data: null,
      error: { message: 'fetch failed' },
    };

    const response = await GET();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to fetch settings');
    expect(capturedPlatformSettingsSelect).toBe(PLATFORM_SETTINGS_SELECT);
  });

  it('returns 403 when CSRF validation fails', async () => {
    mockCheckCsrfProtection.mockResolvedValueOnce({
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
    });

    const response = await PUT(createPutRequest({ platform_name: 'Baci Pro' }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe('Invalid CSRF token');
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
    expect(capturedPlatformSettingsUpdate).toBeNull();
  });

  it('returns 400 when the request payload fails validation', async () => {
    const response = await PUT(
      createPutRequest({
        support_email: 'not-an-email',
      })
    );
    const body = (await response.json()) as {
      error: string;
      details?: { fieldErrors?: Record<string, string[]> };
    };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request payload');
    expect(body.details?.fieldErrors?.support_email).toBeDefined();
    expect(capturedPlatformSettingsUpdate).toBeNull();
  });

  it('returns 403 when the merchant is not a platform admin', async () => {
    merchantAdminResult = {
      data: { is_platform_admin: false },
      error: null,
    };

    const response = await PUT(
      createPutRequest({
        platform_name: 'Baci Pro',
      })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden - Platform admin access required');
    expect(capturedMerchantSelect).toBe('is_platform_admin');
    expect(capturedPlatformSettingsUpdate).toBeNull();
  });

  it('returns 500 when updating platform settings fails', async () => {
    platformSettingsResult = {
      data: null,
      error: { message: 'update failed' },
    };

    const response = await PUT(
      createPutRequest({
        platform_name: 'Baci Pro',
      })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to update settings');
    expect(capturedPlatformSettingsSelect).toBe(PLATFORM_SETTINGS_SELECT);
  });

  it('updates platform settings when the request is valid', async () => {
    platformSettingsResult = {
      data: {
        ...baseSettings,
        platform_name: 'Baci Pro',
        platform_fee_percentage: 3.5,
        enable_custom_domains: false,
        ga4_api_secret: 'replacement-secret',
      },
      error: null,
    };

    const response = await PUT(
      createPutRequest({
        platform_name: 'Baci Pro',
        platform_fee_percentage: '3.5',
        enable_custom_domains: false,
        ga4_api_secret: 'replacement-secret',
        support_email: 'support@baci.app',
      })
    );
    const body = (await response.json()) as PlatformSettingsResponse;

    expect(response.status).toBe(200);
    expect(body.platform_name).toBe('Baci Pro');
    expect(body.platform_fee_percentage).toBe(3.5);
    expect(body.secretStatus.ga4_api_secret).toBe(true);
    expect(body).not.toHaveProperty('ga4_api_secret');
    expect(capturedMerchantSelect).toBe('is_platform_admin');
    expect(capturedPlatformSettingsSelect).toBe(PLATFORM_SETTINGS_SELECT);
    expect(capturedPlatformSettingsUpdate).toEqual(
      expect.objectContaining({
        platform_name: 'Baci Pro',
        platform_fee_percentage: 3.5,
        enable_custom_domains: false,
        ga4_api_secret: 'replacement-secret',
        support_email: 'support@baci.app',
      })
    );
  });
});
