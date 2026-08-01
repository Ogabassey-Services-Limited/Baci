import type { NextRequest } from 'next/server';
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

function createPatchRequest(body: Record<string, unknown>): NextRequest {
  return new Request('http://localhost/api/merchant/settings', {
    method: 'PATCH',
    body: JSON.stringify({
      merchantId: DEFAULT_MERCHANT_ID,
      ...body,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  }) as unknown as NextRequest;
}

describe('PATCH /api/merchant/settings social media', () => {
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

  it('merges a partial social payload over existing handles so untouched ones survive', async () => {
    const response = await PATCH(
      createPatchRequest({
        // Only Instagram is being changed in this partial payload.
        social_media: { instagram: '@newinsta' },
      })
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: false,
      p_merchant_id: DEFAULT_MERCHANT_ID,
      p_settings: {},
      p_social_media: { instagram: '@newinsta' },
    });
  });

  it('fails closed when the atomic social_media update fails', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'rpc failure' },
    });

    const response = await PATCH(
      createPatchRequest({ social_media: { instagram: '@newinsta' } })
    );

    expect(response.status).toBe(500);
  });

  it('clears all social handles when clear_social_media is true', async () => {
    const response = await PATCH(
      createPatchRequest({ social_media: {}, clear_social_media: true })
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: true,
      p_merchant_id: DEFAULT_MERCHANT_ID,
      p_settings: {},
      p_social_media: {},
    });
  });

  it('honors clear_social_media even when social_media is omitted', async () => {
    const response = await PATCH(
      createPatchRequest({ clear_social_media: true })
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: true,
      p_merchant_id: DEFAULT_MERCHANT_ID,
      p_settings: {},
      p_social_media: {},
    });
  });

  it('treats the current full-form all-blank payload as an explicit clear', async () => {
    const social_media = {
      twitter: '',
      facebook: '',
      instagram: '',
      tiktok: '',
      youtube: '',
      pinterest: '',
      linkedin: '',
      snapchat: '',
    };

    const response = await PATCH(createPatchRequest({ social_media }));

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: true,
      p_merchant_id: DEFAULT_MERCHANT_ID,
      p_settings: {},
      p_social_media: social_media,
    });
  });

  it('sends partial blank handles to the atomic merge without the clear flag', async () => {
    const response = await PATCH(
      createPatchRequest({
        // Errored/partial client sent all-blank handles, no clear intent.
        social_media: { twitter: '', instagram: '' },
      })
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: false,
      p_merchant_id: DEFAULT_MERCHANT_ID,
      p_settings: {},
      p_social_media: {
        twitter: '',
        instagram: '',
      },
    });
  });

  it('replaces with a full social object while preserving merge semantics', async () => {
    const response = await PATCH(
      createPatchRequest({
        social_media: {
          twitter: '@baci',
          facebook: 'fb.com/baci',
          instagram: ' ',
        },
      })
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: false,
      p_merchant_id: DEFAULT_MERCHANT_ID,
      p_settings: {},
      p_social_media: {
        twitter: '@baci',
        facebook: 'fb.com/baci',
        instagram: '',
      },
    });
  });
});
