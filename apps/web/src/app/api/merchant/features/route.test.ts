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
vi.mock('@/lib/cache-revalidation', () => ({
  revalidateFeatures: (...args: unknown[]) => mockRevalidateFeatures(...args),
  revalidateMerchant: (...args: unknown[]) => mockRevalidateMerchant(...args),
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

vi.mock('@/schemas/merchant-features', () => ({
  merchantFeatureSettingsSchema: {
    partial: () => ({
      safeParse: (data: Record<string, unknown>) => ({ success: true, data }),
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
let selectColumns: string | null = null;

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
              }),
            };
          }),
          insert: vi.fn((payload: unknown) => {
            insertPayload = payload;
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn(() =>
                  Promise.resolve({ data: insertData, error: insertError })
                ),
              }),
            };
          }),
          upsert: vi.fn((payload: unknown) => {
            upsertPayload = payload;
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn(() =>
                  Promise.resolve({ data: upsertData, error: upsertError })
                ),
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
    upsertPayload = null;
    selectColumns = null;
    csrfValid = true;
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
  });

  it('creates default settings with VTU customer cashback disabled by default', async () => {
    const { GET } = await import('./route');
    settingsError = { code: 'PGRST116', message: 'No rows found' };
    insertData = { id: 'new-settings', merchant_id: MERCHANT_ID };

    const response = await GET(makeRequest('GET'));

    expect(response.status).toBe(200);
    expect(insertPayload).toMatchObject({
      agentic_checkout_enabled: true,
      klump_enabled: false,
      klump_min_amount: 10000,
      klump_max_amount: 500000,
      vtu_customer_cashback_enabled: false,
      vtu_customer_cashback_rate: 50,
    });
  });

  it('returns 401 when not authenticated', async () => {
    const { GET } = await import('./route');
    authResult = { error: 'Unauthorized' };

    const res = await GET(makeRequest('GET'));
    const json = await res.json();

    expect(res.status).toBe(401);
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
    expect(json.id).toBe('settings-1');
  });

  it('creates default settings when none exist (PGRST116)', async () => {
    const { GET } = await import('./route');
    settingsError = { code: 'PGRST116', message: 'No rows found' };
    insertData = { id: 'new-settings', merchant_id: MERCHANT_ID };

    const res = await GET(makeRequest('GET'));

    expect(res.status).toBe(200);
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
    upsertData = {
      id: 'settings-1',
      merchant_id: MERCHANT_ID,
      loyalty_enabled: true,
    };
    upsertError = null;
    upsertPayload = null;
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
  });

  it('returns 403 when no settings.edit permission', async () => {
    const { PATCH } = await import('./route');
    hasSettingsEdit = false;

    const res = await PATCH(makeRequest('PATCH', { loyalty_enabled: true }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('Permission denied');
  });

  it('updates settings and invalidates feature and merchant caches', async () => {
    const { PATCH } = await import('./route');

    const res = await PATCH(
      makeRequest('PATCH', { agentic_checkout_enabled: false })
    );

    expect(res.status).toBe(200);
    expect(mockRevalidateFeatures).toHaveBeenCalledWith(MERCHANT_ID);
    expect(mockRevalidateMerchant).toHaveBeenCalledWith(MERCHANT_ID);
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
    expect(upsertPayload).toMatchObject({
      merchant_id: MERCHANT_ID,
      klump_enabled: true,
      klump_min_amount: 2500,
      klump_max_amount: 750000,
    });
  });

  it('returns 500 when upsert fails', async () => {
    const { PATCH } = await import('./route');
    upsertError = { message: 'DB error' };

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
    upsertData = { id: 'settings-1', merchant_id: MERCHANT_ID };
    upsertError = null;
    upsertPayload = null;
    csrfValid = true;
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
  });

  it('replaces settings and invalidates feature and merchant caches', async () => {
    const { PUT } = await import('./route');

    const res = await PUT(
      makeRequest('PUT', { agentic_checkout_enabled: false })
    );

    expect(res.status).toBe(200);
    expect(upsertPayload).toMatchObject({
      klump_enabled: false,
      klump_min_amount: 10000,
      klump_max_amount: 500000,
    });
    expect(mockRevalidateFeatures).toHaveBeenCalledWith(MERCHANT_ID);
    expect(mockRevalidateMerchant).toHaveBeenCalledWith(MERCHANT_ID);
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
