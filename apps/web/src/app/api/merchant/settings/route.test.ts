import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

const { PATCH } = await import('./route');

function createPatchRequest(body: BodyInit): NextRequest {
  return new Request('http://localhost/api/merchant/settings', {
    method: 'PATCH',
    body,
    headers: {
      'Content-Type': 'application/json',
    },
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
    mockGetUserAccess.mockResolvedValue({
      merchantId: 'merchant-1',
      isOwner: true,
      isStaff: false,
      permissions: {},
      role: 'owner',
    });
    mockHasPermission.mockReturnValue(true);
    mockRpc.mockResolvedValue({
      data: { id: 'merchant-1', social_media: null },
      error: null,
    });
  });

  it('updates normalized merchant settings atomically through one RPC', async () => {
    const response = await PATCH(
      createPatchRequest(
        JSON.stringify({
          social_media: {
            instagram: ' @baci ',
            twitter: ' ',
          },
          tax_identification_number: ' 1234567890 ',
        })
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: false,
      p_merchant_id: 'merchant-1',
      p_settings: { tax_identification_number: '1234567890' },
      p_social_media: { instagram: '@baci', twitter: '' },
    });
    expect(payload).toEqual({
      merchant: {
        id: 'merchant-1',
        social_media: null,
      },
    });
  });

  it('updates ordinary merchant settings through the same atomic RPC', async () => {
    const response = await PATCH(
      createPatchRequest(
        JSON.stringify({
          legal_entity_name: ' Baci Ltd ',
          state_code: ' NG-LA ',
        })
      )
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: false,
      p_merchant_id: 'merchant-1',
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
      createPatchRequest(
        JSON.stringify({
          legal_entity_name: 'Baci Ltd',
        })
      )
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
      createPatchRequest(JSON.stringify({ legal_entity_name: 'Baci Ltd' }))
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
      createPatchRequest(JSON.stringify({ legal_entity_name: 'Baci Ltd' }))
    );

    expect(response.status).toBe(403);
    expect(mockAuthenticateApiRequest).toHaveBeenCalledOnce();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 400 when validation fails', async () => {
    const response = await PATCH(createPatchRequest(JSON.stringify({})));

    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 400 when the request body is invalid json', async () => {
    const response = await PATCH(createPatchRequest('{'));

    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 400 when the only provided change is a false clear flag', async () => {
    const response = await PATCH(
      createPatchRequest(JSON.stringify({ clear_social_media: false }))
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
      createPatchRequest(JSON.stringify({ legal_entity_name: 'Baci Ltd' }))
    );

    expect(response.status).toBe(500);
  });

  it('merges a partial social payload over existing handles so untouched ones survive', async () => {
    const response = await PATCH(
      createPatchRequest(
        JSON.stringify({
          // Only Instagram is being changed in this partial payload.
          social_media: { instagram: '@newinsta' },
        })
      )
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: false,
      p_merchant_id: 'merchant-1',
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
      createPatchRequest(
        JSON.stringify({
          social_media: { instagram: '@newinsta' },
        })
      )
    );

    expect(response.status).toBe(500);
  });

  it('clears all social handles when clear_social_media is true', async () => {
    const response = await PATCH(
      createPatchRequest(
        JSON.stringify({
          social_media: {},
          clear_social_media: true,
        })
      )
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: true,
      p_merchant_id: 'merchant-1',
      p_settings: {},
      p_social_media: {},
    });
  });

  it('honors clear_social_media even when social_media is omitted', async () => {
    const response = await PATCH(
      createPatchRequest(
        JSON.stringify({
          clear_social_media: true,
        })
      )
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: true,
      p_merchant_id: 'merchant-1',
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

    const response = await PATCH(
      createPatchRequest(
        JSON.stringify({
          social_media,
        })
      )
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: true,
      p_merchant_id: 'merchant-1',
      p_settings: {},
      p_social_media: social_media,
    });
  });

  it('sends partial blank handles to the atomic merge without the clear flag', async () => {
    const response = await PATCH(
      createPatchRequest(
        JSON.stringify({
          // Errored/partial client sent all-blank handles, no clear intent.
          social_media: {
            twitter: '',
            instagram: '',
          },
        })
      )
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: false,
      p_merchant_id: 'merchant-1',
      p_settings: {},
      p_social_media: {
        twitter: '',
        instagram: '',
      },
    });
  });

  it('replaces with a full social object while preserving merge semantics', async () => {
    const response = await PATCH(
      createPatchRequest(
        JSON.stringify({
          social_media: {
            twitter: '@baci',
            facebook: 'fb.com/baci',
            instagram: ' ',
          },
        })
      )
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('update_merchant_social_media', {
      p_clear: false,
      p_merchant_id: 'merchant-1',
      p_settings: {},
      p_social_media: {
        twitter: '@baci',
        facebook: 'fb.com/baci',
        instagram: '',
      },
    });
  });
});
