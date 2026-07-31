import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockSupabase,
  MERCHANT_ID,
  makeRequest,
  merchantFeatureSchemaMocks,
  mockGetMerchantFeatureAccess,
  mockRevalidateFeatures,
  mockRevalidateMerchant,
  mockRevalidateRepairsCatalog,
  resetMerchantFeatureSchemaMocks,
  testState,
} from './route.test-support';

describe('PUT /api/merchant/features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMerchantFeatureSchemaMocks();
    const mockSupa = createMockSupabase();
    testState.authResult = { user: { id: 'user-1' }, supabase: mockSupa };
    testState.accessResult = { merchantId: MERCHANT_ID, role: 'owner' };
    testState.hasSettingsEdit = true;
    testState.settingsData = { merchant_id: MERCHANT_ID, custom_settings: {} };
    testState.settingsError = null;
    testState.upsertData = { id: 'settings-1', merchant_id: MERCHANT_ID };
    testState.upsertError = null;
    testState.upsertPayload = null;
    testState.csrfValid = true;
    mockGetMerchantFeatureAccess.mockResolvedValue({
      allowed: true,
      error: null,
    });
  });

  it('returns 401 when not authenticated', async () => {
    const { PUT } = await import('./route');
    testState.authResult = { error: 'Unauthorized' };

    const res = await PUT(makeRequest('PUT', { reviews_enabled: true }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 403 when CSRF validation fails', async () => {
    const { PUT } = await import('./route');
    testState.csrfValid = false;

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
    expect(testState.upsertPayload).toBeNull();
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
    expect(testState.upsertPayload).toMatchObject({
      klump_enabled: false,
      klump_min_amount: 10000,
      klump_max_amount: 1000000,
    });
    expect(testState.selectColumns).toContain('shipping_providers');
    expect(testState.selectColumns).toContain('custom_settings');
    expect(testState.upsertPayload).not.toHaveProperty(
      'offline_conversions_enabled'
    );
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
    expect(testState.upsertPayload).toMatchObject({
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
    expect(testState.upsertPayload).toBeNull();
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
    expect(testState.upsertPayload).toBeNull();
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
    expect(testState.upsertPayload).toMatchObject({
      google_analytics_id: null,
    });
  });

  it('returns 500 when upsert fails', async () => {
    const { PUT } = await import('./route');
    testState.upsertError = { message: 'DB error' };

    const res = await PUT(makeRequest('PUT', { reviews_enabled: true }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to save settings');
  });
});
