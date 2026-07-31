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

describe('PATCH /api/merchant/features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMerchantFeatureSchemaMocks();
    const mockSupa = createMockSupabase();
    testState.authResult = { user: { id: 'user-1' }, supabase: mockSupa };
    testState.accessResult = { merchantId: MERCHANT_ID, role: 'owner' };
    testState.hasSettingsEdit = true;
    testState.settingsData = { merchant_id: MERCHANT_ID };
    testState.settingsError = null;
    testState.insertData = {
      id: 'settings-1',
      merchant_id: MERCHANT_ID,
      loyalty_enabled: true,
    };
    testState.insertError = null;
    testState.insertPayload = null;
    testState.updateData = {
      id: 'settings-1',
      merchant_id: MERCHANT_ID,
      loyalty_enabled: true,
    };
    testState.updateError = null;
    testState.updatePayload = null;
    testState.upsertData = {
      id: 'settings-1',
      merchant_id: MERCHANT_ID,
      loyalty_enabled: true,
    };
    testState.upsertError = null;
    testState.upsertPayload = null;
    testState.throwOnInsert = false;
    testState.csrfValid = true;
  });

  it('returns 401 when not authenticated', async () => {
    const { PATCH } = await import('./route');
    testState.authResult = { error: 'Unauthorized' };

    const res = await PATCH(makeRequest('PATCH', { loyalty_enabled: true }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 403 when CSRF validation fails', async () => {
    const { PATCH } = await import('./route');
    testState.csrfValid = false;

    const res = await PATCH(makeRequest('PATCH', { loyalty_enabled: true }));

    expect(res.status).toBe(403);
    expect(res.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, max-age=0, must-revalidate'
    );
  });

  it('returns 403 when no settings.edit permission', async () => {
    const { PATCH } = await import('./route');
    testState.hasSettingsEdit = false;

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
    expect(testState.upsertPayload).toBeNull();
    expect(testState.insertPayload).toBeNull();
    expect(testState.updatePayload).toBeNull();
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
    expect(testState.selectColumns).toContain('shipping_providers');
    expect(testState.selectColumns).toContain('custom_settings');
    expect(mockRevalidateFeatures).toHaveBeenCalledWith(MERCHANT_ID);
    expect(mockRevalidateMerchant).toHaveBeenCalledWith(MERCHANT_ID);
    expect(mockRevalidateRepairsCatalog).not.toHaveBeenCalled();
  });

  it('revalidates repairs feeds when PATCH toggles the repairs catalogue', async () => {
    const { PATCH } = await import('./route');
    testState.updateData = {
      id: 'settings-1',
      merchant_id: MERCHANT_ID,
      repairs_catalog_enabled: false,
    };

    const res = await PATCH(
      makeRequest('PATCH', { repairs_catalog_enabled: false })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.repairs_catalog_enabled).toBe(false);
    expect(testState.updatePayload).toMatchObject({
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
    expect(testState.updatePayload).toBeNull();
    expect(testState.insertPayload).toBeNull();
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
    expect(testState.updatePayload).toBeNull();
    expect(testState.insertPayload).toBeNull();
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
    expect(testState.updatePayload).toMatchObject({
      facebook_capi_token: null,
    });
  });
});
