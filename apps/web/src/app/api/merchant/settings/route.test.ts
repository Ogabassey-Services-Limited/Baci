import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockEq = vi.fn(() => ({ select: mockSelect }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ update: mockUpdate }));

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
      supabase: { from: mockFrom },
    });
    mockGetUserAccess.mockResolvedValue({
      merchantId: 'merchant-1',
      isOwner: true,
      isStaff: false,
      permissions: {},
      role: 'owner',
    });
    mockHasPermission.mockReturnValue(true);
    mockSingle.mockResolvedValue({
      data: { id: 'merchant-1' },
      error: null,
    });
  });

  it('updates normalized merchant settings', async () => {
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

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        social_media: { instagram: '@baci' },
        tax_identification_number: '1234567890',
      })
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'merchant-1');
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
    expect(mockUpdate).not.toHaveBeenCalled();
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
    expect(mockUpdate).not.toHaveBeenCalled();
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
    expect(mockAuthenticateApiRequest).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when validation fails', async () => {
    const response = await PATCH(createPatchRequest(JSON.stringify({})));

    expect(response.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when the request body is invalid json', async () => {
    const response = await PATCH(createPatchRequest('{'));

    expect(response.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 500 when the merchant update fails', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'db failure' },
    });

    const response = await PATCH(
      createPatchRequest(JSON.stringify({ legal_entity_name: 'Baci Ltd' }))
    );

    expect(response.status).toBe(500);
  });
});
