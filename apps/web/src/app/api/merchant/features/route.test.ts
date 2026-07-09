import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

const mockRevalidateFeatures = vi.fn();
const mockRevalidateMerchant = vi.fn();
const mockRevalidateRepairsCatalog = vi.fn();
vi.mock('@/lib/cache-revalidation', () => ({
  revalidateFeatures: (...args: unknown[]) => mockRevalidateFeatures(...args),
  revalidateMerchant: (...args: unknown[]) => mockRevalidateMerchant(...args),
  revalidateRepairsCatalog: (...args: unknown[]) =>
    mockRevalidateRepairsCatalog(...args),
}));

const mockGetMerchantFeatureAccess = vi.fn();
vi.mock('@/lib/merchant-feature-gates', () => ({
  getMerchantFeatureAccess: (...args: unknown[]) =>
    mockGetMerchantFeatureAccess(...args),
  merchantFeatureUpgradeResponse: () =>
    Response.json(
      {
        code: 'requires_upgrade',
        error: 'Growth integrations require Baci Pro',
      },
      { status: 402 }
    ),
}));

let csrfValid = true;
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({
      valid: csrfValid,
      response: csrfValid
        ? null
        : new Response(JSON.stringify({ error: 'CSRF validation failed' }), {
            status: 403,
          }),
    })
  ),
}));

const merchantFeatureSchemaMocks = vi.hoisted(() => ({
  patchSafeParse: vi.fn(),
  replacementSafeParse: vi.fn(),
}));

function resetMerchantFeatureSchemaMocks() {
  merchantFeatureSchemaMocks.patchSafeParse.mockImplementation(
    (data: Record<string, unknown>) => ({ success: true as const, data })
  );
  merchantFeatureSchemaMocks.replacementSafeParse.mockImplementation(
    (data: Record<string, unknown>) => ({
      success: true as const,
      data: {
        ...data,
        klump_enabled: false,
        klump_min_amount: 10_000,
        klump_max_amount: 1_000_000,
      },
    })
  );
}

vi.mock('@/schemas/merchant-features', () => ({
  merchantFeatureSettingsPatchSchema: {
    safeParse: (data: Record<string, unknown>) =>
      merchantFeatureSchemaMocks.patchSafeParse(data),
  },
  merchantFeatureSettingsSchema: {
    partial: () => ({
      safeParse: (data: Record<string, unknown>) =>
        merchantFeatureSchemaMocks.replacementSafeParse(data),
    }),
  },
}));

// Auth + access mocks
const MERCHANT_ID = 'merchant-123';
let authResult: {
  error?: string;
  user?: { id: string } | null;
  supabase?: ReturnType<typeof createMockSupabase>;
};
let accessResult: { merchantId: string; role: string } | null;
let hasSettingsView = true;
let hasSettingsEdit = true;
let hasMarketingView = true;
let hasDashboardView = true;

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(() => Promise.resolve(authResult)),
  getUserAccess: vi.fn(() => Promise.resolve(accessResult)),
  hasPermission: vi.fn((_access: unknown, resource: string, action: string) => {
    if (resource === 'settings' && action === 'view') return hasSettingsView;
    if (resource === 'settings' && action === 'edit') return hasSettingsEdit;
    if (resource === 'marketing' && action === 'view') return hasMarketingView;
    if (resource === 'dashboard' && action === 'view') return hasDashboardView;
    return false;
  }),
}));

// Supabase mock
let settingsData: unknown = {
  id: 'settings-1',
  merchant_id: MERCHANT_ID,
  loyalty_enabled: false,
};
let settingsError: unknown = null;
let upsertData: unknown = null;
let upsertError: unknown = null;
let upsertPayload: unknown = null;
let insertData: unknown = null;
let insertError: unknown = null;
let insertPayload: unknown = null;
let updateData: unknown = null;
let updateError: unknown = null;
let updatePayload: unknown = null;
let selectColumns: string | null = null;
let throwOnInsert = false;

function createMockSupabase() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'merchant_feature_settings') {
        return {
          select: vi.fn((columns: string) => {
            selectColumns = columns;
            return {
              eq: vi.fn().mockReturnValue({
                single: vi.fn(() =>
                  Promise.resolve({ data: settingsData, error: settingsError })
                ),
                maybeSingle: vi.fn(() =>
                  Promise.resolve({ data: settingsData, error: settingsError })
                ),
              }),
            };
          }),
          insert: vi.fn((payload: unknown) => {
            if (throwOnInsert) {
              throw new Error('GET must not persist default settings');
            }
            insertPayload = payload;
            return {
              select: vi.fn((columns: string) => {
                selectColumns = columns;
                return {
                  single: vi.fn(() =>
                    Promise.resolve({ data: insertData, error: insertError })
                  ),
                };
              }),
            };
          }),
          update: vi.fn((payload: unknown) => {
            updatePayload = payload;
            return {
              eq: vi.fn().mockReturnValue({
                select: vi.fn((columns: string) => {
                  selectColumns = columns;
                  return {
                    single: vi.fn(() =>
                      Promise.resolve({ data: updateData, error: updateError })
                    ),
                  };
                }),
              }),
            };
          }),
          upsert: vi.fn((payload: unknown) => {
            upsertPayload = payload;
            return {
              select: vi.fn((columns: string) => {
                selectColumns = columns;
                return {
                  single: vi.fn(() =>
                    Promise.resolve({ data: upsertData, error: upsertError })
                  ),
                };
              }),
            };
          }),
        };
      }
      return { select: vi.fn().mockReturnThis() };
    }),
  };
}

// ---- Helpers ----

function makeRequest(
  method: string,
  body?: Record<string, unknown>
): NextRequest {
  return new NextRequest('http://localhost:3000/api/merchant/features', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ---- Tests ----

beforeEach(() => {
  resetMerchantFeatureSchemaMocks();
  mockGetMerchantFeatureAccess.mockReset();
  mockGetMerchantFeatureAccess.mockResolvedValue({
    allowed: true,
    error: null,
  });
});

describe('GET /api/merchant/features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockSupa = createMockSupabase();
    authResult = { user: { id: 'user-1' }, supabase: mockSupa };
    accessResult = { merchantId: MERCHANT_ID, role: 'owner' };
    hasSettingsView = true;
    hasSettingsEdit = true;
    hasMarketingView = true;
    hasDashboardView = true;
    settingsData = { id: 'settings-1', merchant_id: MERCHANT_ID };
    settingsError = null;
    insertData = null;
    insertError = null;
    insertPayload = null;
    updateData = null;
    updateError = null;
    updatePayload = null;
    upsertPayload = null;
    selectColumns = null;
    throwOnInsert = false;
    csrfValid = true;
    mockGetMerchantFeatureAccess.mockResolvedValue({
      allowed: true,
      error: null,
    });
  });

  it('selects all VTU category and customer cashback fields', async () => {
    const { GET } = await import('./route');

    const response = await GET(makeRequest('GET'));

    expect(response.status).toBe(200);
    expect(selectColumns).toContain('agentic_checkout_enabled');
    expect(selectColumns).toContain('klump_enabled');
    expect(selectColumns).toContain('klump_min_amount');
    expect(selectColumns).toContain('klump_max_amount');
    expect(selectColumns).toContain('vtu_electricity_enabled');
    expect(selectColumns).toContain('vtu_tv_enabled');
    expect(selectColumns).toContain('vtu_betting_enabled');
    expect(selectColumns).toContain('vtu_customer_cashback_enabled');
    expect(selectColumns).toContain('vtu_customer_cashback_rate');
    expect(selectColumns).not.toContain('offline_conversions_enabled');
  });

  it('returns read-only default settings with VTU customer cashback disabled by default', async () => {
    const { GET } = await import('./route');
    settingsData = null;
    settingsError = null;
    throwOnInsert = true;

    const response = await GET(makeRequest('GET'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      id: null,
      merchant_id: MERCHANT_ID,
      agentic_checkout_enabled: true,
      klump_enabled: false,
      klump_min_amount: 10000,
      klump_max_amount: 1000000,
      vtu_customer_cashback_enabled: false,
      vtu_customer_cashback_rate: 50,
      created_at: null,
      updated_at: null,
    });
    expect(data).not.toHaveProperty('blog_discover_image_validation_enabled');
    expect(data).not.toHaveProperty('juicyway_enabled');
    expect(data).not.toHaveProperty('wallet_order_auto_debit_enabled');
    expect(data).not.toHaveProperty('offline_conversions_enabled');
  });

  it('returns 401 when not authenticated', async () => {
    const { GET } = await import('./route');
    authResult = { error: 'Unauthorized' };

    const res = await GET(makeRequest('GET'));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, max-age=0, must-revalidate'
    );
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 404 when merchant not found', async () => {
    const { GET } = await import('./route');
    accessResult = null;

    const res = await GET(makeRequest('GET'));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Merchant not found');
  });

  it('returns 403 when no relevant permission', async () => {
    const { GET } = await import('./route');
    hasSettingsView = false;
    hasMarketingView = false;
    hasDashboardView = false;

    const res = await GET(makeRequest('GET'));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('Permission denied');
  });

  it('returns settings when found', async () => {
    const { GET } = await import('./route');

    const res = await GET(makeRequest('GET'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, max-age=0, must-revalidate'
    );
    expect(json.id).toBe('settings-1');
  });

  it('redacts Zoho Campaigns secrets from custom_settings responses', async () => {
    const { GET } = await import('./route');
    settingsData = {
      id: 'settings-1',
      merchant_id: MERCHANT_ID,
      custom_settings: {
        dashboardTheme: 'compact',
        zohoCampaigns: {
          apiDomain: 'https://campaigns.zoho.eu',
          enabled: true,
          refreshToken: 'secret-refresh-token',
        },
        zoho_campaigns: {
          client_secret: 'secret-client',
          refresh_token: 'secret-refresh-token-2',
          topic_id: 'topic-1',
        },
      },
    };

    const res = await GET(makeRequest('GET'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.custom_settings).toEqual({
      dashboardTheme: 'compact',
      zohoCampaigns: {
        apiDomain: 'https://campaigns.zoho.eu',
        enabled: true,
      },
      zoho_campaigns: { topic_id: 'topic-1' },
    });
  });

  it('keeps GET read-only when no settings exist', async () => {
    const { GET } = await import('./route');
    settingsData = null;
    settingsError = null;
    throwOnInsert = true;

    const res = await GET(makeRequest('GET'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      merchant_id: MERCHANT_ID,
      shipping_providers: ['gigl', 'topship'],
    });
  });

  it('returns 500 when DB error occurs', async () => {
    const { GET } = await import('./route');
    settingsError = { code: 'UNEXPECTED', message: 'DB error' };

    const res = await GET(makeRequest('GET'));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to fetch settings');
  });
});

describe('PATCH /api/merchant/features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockSupa = createMockSupabase();
    authResult = { user: { id: 'user-1' }, supabase: mockSupa };
    accessResult = { merchantId: MERCHANT_ID, role: 'owner' };
    hasSettingsEdit = true;
    settingsData = { merchant_id: MERCHANT_ID };
    settingsError = null;
    insertData = {
      id: 'settings-1',
      merchant_id: MERCHANT_ID,
      loyalty_enabled: true,
    };
    insertError = null;
    insertPayload = null;
    updateData = {
      id: 'settings-1',
      merchant_id: MERCHANT_ID,
      loyalty_enabled: true,
    };
    updateError = null;
    updatePayload = null;
    upsertData = {
      id: 'settings-1',
      merchant_id: MERCHANT_ID,
      loyalty_enabled: true,
    };
    upsertError = null;
    upsertPayload = null;
    throwOnInsert = false;
    csrfValid = true;
  });

  it('returns 401 when not authenticated', async () => {
    const { PATCH } = await import('./route');
    authResult = { error: 'Unauthorized' };

    const res = await PATCH(makeRequest('PATCH', { loyalty_enabled: true }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 403 when CSRF validation fails', async () => {
    const { PATCH } = await import('./route');
    csrfValid = false;

    const res = await PATCH(makeRequest('PATCH', { loyalty_enabled: true }));

    expect(res.status).toBe(403);
    expect(res.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, max-age=0, must-revalidate'
    );
  });

  it('returns 403 when no settings.edit permission', async () => {
    const { PATCH } = await import('./route');
    hasSettingsEdit = false;

    const res = await PATCH(makeRequest('PATCH', { loyalty_enabled: true }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('Permission denied');
  });

  it('returns 400 when PATCH payload validation fails', async () => {
    const { PATCH } = await import('./route');
    merchantFeatureSchemaMocks.patchSafeParse.mockReturnValueOnce({
      success: false,
      error: {
        flatten: () => ({
          fieldErrors: { loyalty_enabled: ['Expected boolean'] },
        }),
      },
    });

    const res = await PATCH(makeRequest('PATCH', { loyalty_enabled: 'yes' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid input');
    expect(json.details).toEqual({ loyalty_enabled: ['Expected boolean'] });
    expect(upsertPayload).toBeNull();
    expect(insertPayload).toBeNull();
    expect(updatePayload).toBeNull();
  });

  it('updates settings and invalidates feature and merchant caches', async () => {
    const { PATCH } = await import('./route');

    const res = await PATCH(
      makeRequest('PATCH', { agentic_checkout_enabled: false })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, max-age=0, must-revalidate'
    );
    expect(selectColumns).toContain('shipping_providers');
    expect(selectColumns).toContain('custom_settings');
    expect(mockRevalidateFeatures).toHaveBeenCalledWith(MERCHANT_ID);
    expect(mockRevalidateMerchant).toHaveBeenCalledWith(MERCHANT_ID);
    expect(mockRevalidateRepairsCatalog).not.toHaveBeenCalled();
  });

  it('revalidates repairs feeds when PATCH toggles the repairs catalogue', async () => {
    const { PATCH } = await import('./route');

    const res = await PATCH(
      makeRequest('PATCH', { repairs_catalog_enabled: false })
    );

    expect(res.status).toBe(200);
    expect(updatePayload).toMatchObject({
      repairs_catalog_enabled: false,
    });
    expect(mockRevalidateFeatures).toHaveBeenCalledWith(MERCHANT_ID);
    expect(mockRevalidateMerchant).toHaveBeenCalledWith(MERCHANT_ID);
    expect(mockRevalidateRepairsCatalog).toHaveBeenCalledWith(MERCHANT_ID);
  });

  it('returns 402 before updating analytics credentials without growth integrations', async () => {
    const { PATCH } = await import('./route');
    mockGetMerchantFeatureAccess.mockResolvedValueOnce({
      allowed: false,
      error: null,
    });

    const res = await PATCH(
      makeRequest('PATCH', { facebook_capi_token: 'new-token' })
    );
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.code).toBe('requires_upgrade');
    expect(updatePayload).toBeNull();
    expect(insertPayload).toBeNull();
  });

  it('returns 500 when growth integration access cannot be checked before PATCH', async () => {
    const { PATCH } = await import('./route');
    mockGetMerchantFeatureAccess.mockResolvedValueOnce({
      allowed: false,
      error: { message: 'entitlement lookup failed' },
    });

    const res = await PATCH(
      makeRequest('PATCH', { facebook_capi_token: 'new-token' })
    );
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to verify merchant plan');
    expect(updatePayload).toBeNull();
    expect(insertPayload).toBeNull();
  });

  it('allows locked merchants to clear analytics credentials with PATCH', async () => {
    const { PATCH } = await import('./route');
    mockGetMerchantFeatureAccess.mockResolvedValueOnce({
      allowed: false,
      error: null,
    });

    const res = await PATCH(
      makeRequest('PATCH', { facebook_capi_token: null })
    );

    expect(res.status).toBe(200);
    expect(mockGetMerchantFeatureAccess).not.toHaveBeenCalled();
    expect(updatePayload).toMatchObject({ facebook_capi_token: null });
  });

  it('does not reset existing Klump settings on sparse PATCH payloads', async () => {
    const { PATCH } = await import('./route');

    const res = await PATCH(makeRequest('PATCH', { loyalty_enabled: true }));

    expect(res.status).toBe(200);
    expect(updatePayload).toMatchObject({
      loyalty_enabled: true,
      rewards_page_enabled: true,
    });
    expect(updatePayload).not.toHaveProperty('klump_enabled');
    expect(updatePayload).not.toHaveProperty('klump_min_amount');
    expect(updatePayload).not.toHaveProperty('klump_max_amount');
  });

  it('preserves stored Zoho Campaigns secrets while redacting PATCH responses', async () => {
    const { PATCH } = await import('./route');
    settingsData = {
      merchant_id: MERCHANT_ID,
      custom_settings: {
        zohoCampaigns: {
          enabled: true,
          listKey: 'list-key',
          refreshToken: 'stored-refresh-token',
        },
      },
    };
    updateData = {
      id: 'settings-1',
      merchant_id: MERCHANT_ID,
      custom_settings: {
        zohoCampaigns: {
          enabled: false,
          listKey: 'list-key',
          refreshToken: 'stored-refresh-token',
        },
      },
    };

    const res = await PATCH(
      makeRequest('PATCH', {
        custom_settings: { zohoCampaigns: { enabled: false } },
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(updatePayload).toMatchObject({
      custom_settings: {
        zohoCampaigns: {
          enabled: false,
          listKey: 'list-key',
          refreshToken: 'stored-refresh-token',
        },
      },
    });
    expect(json.custom_settings).toEqual({
      zohoCampaigns: {
        enabled: false,
        listKey: 'list-key',
      },
    });
  });

  it('seeds API defaults when the first PATCH creates a settings row', async () => {
    const { PATCH } = await import('./route');
    settingsData = null;
    insertData = {
      id: 'settings-1',
      merchant_id: MERCHANT_ID,
      custom_settings: { integrationCardsCollapsed: true },
    };

    const res = await PATCH(
      makeRequest('PATCH', {
        custom_settings: { integrationCardsCollapsed: true },
      })
    );

    expect(res.status).toBe(200);
    expect(insertPayload).toMatchObject({
      merchant_id: MERCHANT_ID,
      custom_settings: { integrationCardsCollapsed: true },
      shipping_providers: ['gigl', 'topship'],
      klump_enabled: false,
      vtu_customer_cashback_enabled: false,
    });
    expect(selectColumns).toContain('shipping_providers');
    expect(selectColumns).toContain('custom_settings');
    expect(updatePayload).toBeNull();
  });

  it('retries sparse PATCH as an update if a concurrent first insert wins', async () => {
    const { PATCH } = await import('./route');
    settingsData = null;
    insertError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    };
    updateData = {
      id: 'settings-1',
      merchant_id: MERCHANT_ID,
      loyalty_enabled: true,
      rewards_page_enabled: true,
    };

    const res = await PATCH(makeRequest('PATCH', { loyalty_enabled: true }));

    expect(res.status).toBe(200);
    expect(insertPayload).toMatchObject({
      merchant_id: MERCHANT_ID,
      loyalty_enabled: true,
      rewards_page_enabled: true,
      shipping_providers: ['gigl', 'topship'],
    });
    expect(updatePayload).toMatchObject({
      loyalty_enabled: true,
      rewards_page_enabled: true,
    });
    expect(selectColumns).toContain('shipping_providers');
    expect(selectColumns).toContain('custom_settings');
    expect(updatePayload).not.toHaveProperty('shipping_providers');
  });

  it('updates merchant-scoped Klump installment settings', async () => {
    const { PATCH } = await import('./route');

    const res = await PATCH(
      makeRequest('PATCH', {
        klump_enabled: true,
        klump_min_amount: 2500,
        klump_max_amount: 750000,
      })
    );

    expect(res.status).toBe(200);
    expect(updatePayload).toMatchObject({
      klump_enabled: true,
      klump_min_amount: 2500,
      klump_max_amount: 750000,
    });
  });

  it('returns 500 when upsert fails', async () => {
    const { PATCH } = await import('./route');
    upsertError = { message: 'DB error' };
    updateError = { message: 'DB error' };

    const res = await PATCH(makeRequest('PATCH', { loyalty_enabled: true }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to update settings');
  });
});

describe('PUT /api/merchant/features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockSupa = createMockSupabase();
    authResult = { user: { id: 'user-1' }, supabase: mockSupa };
    accessResult = { merchantId: MERCHANT_ID, role: 'owner' };
    hasSettingsEdit = true;
    settingsData = { merchant_id: MERCHANT_ID, custom_settings: {} };
    settingsError = null;
    upsertData = { id: 'settings-1', merchant_id: MERCHANT_ID };
    upsertError = null;
    upsertPayload = null;
    csrfValid = true;
    mockGetMerchantFeatureAccess.mockResolvedValue({
      allowed: true,
      error: null,
    });
  });

  it('returns 401 when not authenticated', async () => {
    const { PUT } = await import('./route');
    authResult = { error: 'Unauthorized' };

    const res = await PUT(makeRequest('PUT', { reviews_enabled: true }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 403 when CSRF validation fails', async () => {
    const { PUT } = await import('./route');
    csrfValid = false;

    const res = await PUT(makeRequest('PUT', { reviews_enabled: true }));

    expect(res.status).toBe(403);
    expect(res.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, max-age=0, must-revalidate'
    );
  });

  it('returns 400 when PUT payload validation fails', async () => {
    const { PUT } = await import('./route');
    merchantFeatureSchemaMocks.patchSafeParse.mockReturnValueOnce({
      success: false,
      error: {
        flatten: () => ({
          fieldErrors: { reviews_enabled: ['Expected boolean'] },
        }),
      },
    });

    const res = await PUT(makeRequest('PUT', { reviews_enabled: 'yes' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid input');
    expect(json.details).toEqual({ reviews_enabled: ['Expected boolean'] });
    expect(upsertPayload).toBeNull();
  });

  it('replaces settings and invalidates feature and merchant caches', async () => {
    const { PUT } = await import('./route');

    const res = await PUT(
      makeRequest('PUT', { agentic_checkout_enabled: false })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, max-age=0, must-revalidate'
    );
    expect(upsertPayload).toMatchObject({
      klump_enabled: false,
      klump_min_amount: 10000,
      klump_max_amount: 1000000,
    });
    expect(selectColumns).toContain('shipping_providers');
    expect(selectColumns).toContain('custom_settings');
    expect(upsertPayload).not.toHaveProperty('offline_conversions_enabled');
    expect(mockRevalidateFeatures).toHaveBeenCalledWith(MERCHANT_ID);
    expect(mockRevalidateMerchant).toHaveBeenCalledWith(MERCHANT_ID);
    expect(mockRevalidateRepairsCatalog).not.toHaveBeenCalled();
  });

  it('revalidates repairs feeds when PUT includes the repairs catalogue flag', async () => {
    const { PUT } = await import('./route');

    const res = await PUT(
      makeRequest('PUT', { repairs_catalog_enabled: true })
    );

    expect(res.status).toBe(200);
    expect(upsertPayload).toMatchObject({
      repairs_catalog_enabled: true,
    });
    expect(mockRevalidateFeatures).toHaveBeenCalledWith(MERCHANT_ID);
    expect(mockRevalidateMerchant).toHaveBeenCalledWith(MERCHANT_ID);
    expect(mockRevalidateRepairsCatalog).toHaveBeenCalledWith(MERCHANT_ID);
  });

  it('returns 402 before replacing analytics credentials without growth integrations', async () => {
    const { PUT } = await import('./route');
    mockGetMerchantFeatureAccess.mockResolvedValueOnce({
      allowed: false,
      error: null,
    });

    const res = await PUT(
      makeRequest('PUT', { google_analytics_id: 'G-LOCKED' })
    );
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.code).toBe('requires_upgrade');
    expect(upsertPayload).toBeNull();
  });

  it('returns 500 when growth integration access cannot be checked before PUT', async () => {
    const { PUT } = await import('./route');
    mockGetMerchantFeatureAccess.mockResolvedValueOnce({
      allowed: false,
      error: { message: 'entitlement lookup failed' },
    });

    const res = await PUT(
      makeRequest('PUT', { google_analytics_id: 'G-LOCKED' })
    );
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to verify merchant plan');
    expect(upsertPayload).toBeNull();
  });

  it('allows locked merchants to clear analytics credentials with PUT', async () => {
    const { PUT } = await import('./route');
    mockGetMerchantFeatureAccess.mockResolvedValueOnce({
      allowed: false,
      error: null,
    });

    const res = await PUT(makeRequest('PUT', { google_analytics_id: null }));

    expect(res.status).toBe(200);
    expect(mockGetMerchantFeatureAccess).not.toHaveBeenCalled();
    expect(upsertPayload).toMatchObject({ google_analytics_id: null });
  });

  it('returns 500 when upsert fails', async () => {
    const { PUT } = await import('./route');
    upsertError = { message: 'DB error' };

    const res = await PUT(makeRequest('PUT', { reviews_enabled: true }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to save settings');
  });
});
