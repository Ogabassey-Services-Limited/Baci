import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockAuthenticateApiRequest = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();
const mockRpc = vi.fn();
const DEFAULT_MERCHANT_ID = '11111111-1111-4111-8111-111111111111';

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: (context: { merchantId: string; staffAccess: object }) => ({
    merchantId: context.merchantId,
    ...context.staffAccess,
  }),
}));

const { PATCH } = await import('./route');

function createPatchRequest(body: Record<string, unknown> = {}): NextRequest {
  return new Request('http://localhost/api/merchant/settings', {
    method: 'PATCH',
    body: JSON.stringify({ merchantId: DEFAULT_MERCHANT_ID, ...body }),
    headers: {
      'Content-Type': 'application/json',
    },
  }) as unknown as NextRequest;
}

function createMalformedPatchRequest(): NextRequest {
  return new Request('http://localhost/api/merchant/settings', {
    method: 'PATCH',
    body: '{',
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

describe('PATCH /api/merchant/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: 'user-1' },
      supabase: { rpc: mockRpc },
    });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: DEFAULT_MERCHANT_ID,
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: {},
        role: 'owner',
      },
    });
    mockHasPermission.mockReturnValue(true);
    mockRpc.mockResolvedValue({
      data: { id: DEFAULT_MERCHANT_ID, social_media: null },
      error: null,
    });
  });

  it('updates normalized merchant settings atomically through one RPC', async () => {
    const response = await PATCH(
      createPatchRequest({
        social_media: { instagram: ' @baci ', twitter: ' ' },
        tax_identification_number: ' 1234567890 ',
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: false,
      p_merchant_id: DEFAULT_MERCHANT_ID,
      p_settings: { tax_identification_number: '1234567890' },
      p_social_media: { instagram: '@baci', twitter: '' },
    });
    expect(payload).toEqual({
      merchant: {
        id: DEFAULT_MERCHANT_ID,
        social_media: null,
      },
    });
  });

  it('writes social media to the merchant asserted by a multi-merchant caller', async () => {
    const requestedMerchantId = '22222222-2222-4222-8222-222222222222';
    mockGetMerchantForApiRequest.mockResolvedValueOnce({
      merchantId: requestedMerchantId,
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: {},
        role: 'owner',
      },
    });

    const response = await PATCH(
      createPatchRequest({
        merchantId: requestedMerchantId,
        social_media: { instagram: '@second-store' },
      })
    );

    expect(response.status).toBe(200);
    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      { requestedMerchantId }
    );
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: false,
      p_merchant_id: requestedMerchantId,
      p_settings: {},
      p_social_media: { instagram: '@second-store' },
    });
  });

  it('updates ordinary merchant settings through the same atomic RPC', async () => {
    const response = await PATCH(
      createPatchRequest({
        legal_entity_name: ' Baci Ltd ',
        state_code: ' NG-LA ',
      })
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: false,
      p_merchant_id: DEFAULT_MERCHANT_ID,
      p_settings: {
        legal_entity_name: 'Baci Ltd',
        state_code: 'NG-LA',
      },
      p_social_media: {},
    });
  });

  it('rejects users without settings edit permission', async () => {
    mockHasPermission.mockReturnValue(false);

    const response = await PATCH(
      createPatchRequest({ legal_entity_name: 'Baci Ltd' })
    );

    expect(response.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 401 when authentication fails', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      user: null,
      supabase: null,
    });

    const response = await PATCH(
      createPatchRequest({ legal_entity_name: 'Baci Ltd' })
    );

    expect(response.status).toBe(401);
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 403 when csrf validation fails', async () => {
    mockCheckCsrfProtection.mockResolvedValue({
      valid: false,
      response: NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      ),
    });

    const response = await PATCH(
      createPatchRequest({ legal_entity_name: 'Baci Ltd' })
    );

    expect(response.status).toBe(403);
    expect(mockAuthenticateApiRequest).toHaveBeenCalledOnce();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 400 when validation fails', async () => {
    const response = await PATCH(createPatchRequest());

    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 400 when the request body is invalid json', async () => {
    const response = await PATCH(createMalformedPatchRequest());

    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 400 when the only provided change is a false clear flag', async () => {
    const response = await PATCH(
      createPatchRequest({ clear_social_media: false })
    );

    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 500 when the atomic settings RPC fails', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'db failure' },
    });

    const response = await PATCH(
      createPatchRequest({ legal_entity_name: 'Baci Ltd' })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: 'MERCHANT_SETTINGS_UPDATE_FAILED',
      error: 'Failed to update merchant settings',
    });
  });

  it('returns the stable server failure envelope when merchant resolution fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetMerchantForApiRequest.mockRejectedValueOnce(
      new Error('merchant lookup unavailable')
    );

    const response = await PATCH(
      createPatchRequest({ legal_entity_name: 'Baci Ltd' })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: 'MERCHANT_SETTINGS_UPDATE_FAILED',
      error: 'Failed to update merchant settings',
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns a reauthentication challenge for a stale identity-settings session', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'merchant_settings_reauthentication_required' },
    });

    const response = await PATCH(
      createPatchRequest({ legal_entity_name: 'Baci Limited' })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'REAUTHENTICATION_REQUIRED',
      error: 'Sign in again before changing merchant settings.',
    });
  });

  it('returns an MFA challenge when a verified factor has not been asserted', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'merchant_settings_mfa_required' },
    });

    const response = await PATCH(
      createPatchRequest({ legal_entity_name: 'Baci Limited' })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'MFA_REQUIRED',
      error: 'Verify your second factor before changing merchant settings.',
    });
  });
});
