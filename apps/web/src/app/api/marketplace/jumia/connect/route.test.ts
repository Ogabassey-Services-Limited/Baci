import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn();
const mockUpsert = vi.fn();
const mockSelect = vi.fn().mockReturnValue({ single: vi.fn() });
const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: vi.fn(() => ({
    upsert: (...a: unknown[]) => {
      mockUpsert(...a);
      return { select: () => mockSelect() };
    },
  })),
};

vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({}) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn().mockResolvedValue({ valid: true }),
}));

const mockGetMerchant = vi.fn();
const mockToUserAccess = vi.fn();
const mockGetJumiaAuthUrl = vi
  .fn()
  .mockReturnValue('https://jumia.com/auth?state=xyz');
const { mockGetConfiguredAppUrl } = vi.hoisted(() => ({
  mockGetConfiguredAppUrl: vi.fn(
    () => process.env.NEXT_PUBLIC_APP_URL?.trim() ?? null
  ),
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...a: unknown[]) => mockGetMerchant(...a),
  toUserAccess: (...a: unknown[]) => mockToUserAccess(...a),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/jumia/helpers', () => ({
  getJumiaAuthUrl: (...a: unknown[]) => mockGetJumiaAuthUrl(...a),
  getJumiaRedirectUri: vi.fn(
    () => 'http://localhost:3000/api/marketplace/jumia/callback'
  ),
}));

vi.mock('@/env', () => ({
  getConfiguredAppUrl: mockGetConfiguredAppUrl,
  getJumiaClientId: vi.fn(() => process.env.JUMIA_CLIENT_ID),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const MERCHANT_CTX = {
  merchantId: '00000000-0000-0000-0000-000000000001',
  staffAccess: {
    role: 'owner',
    isOwner: true,
    isStaff: false,
    permissions: {},
  },
};

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/marketplace/jumia/connect', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeGetRequest(search = '') {
  return new NextRequest(
    `http://localhost/api/marketplace/jumia/connect${search}`
  );
}

function setupAuth() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  mockGetMerchant.mockResolvedValue(MERCHANT_CTX);
  mockToUserAccess.mockReturnValue({
    merchantId: MERCHANT_CTX.merchantId,
    role: 'owner',
    isOwner: true,
    isStaff: false,
    permissions: {},
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

import { GET, POST } from './route';

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalJumiaClientId = process.env.JUMIA_CLIENT_ID;

function restoreEnv() {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }

  if (originalJumiaClientId === undefined) {
    delete process.env.JUMIA_CLIENT_ID;
  } else {
    process.env.JUMIA_CLIENT_ID = originalJumiaClientId;
  }
}

describe('Connect POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.JUMIA_CLIENT_ID = 'test-client-id';
    mockSelect.mockReturnValue({ single: vi.fn() });
    mockGetJumiaAuthUrl.mockReturnValue('https://jumia.com/auth?state=xyz');
  });

  afterEach(() => {
    restoreEnv();
  });

  it('returns 403 on CSRF failure', async () => {
    const { checkCsrfProtection } = await import('@/lib/csrf');
    (checkCsrfProtection as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      valid: false,
      response: null,
    });
    const res = await POST(makePostRequest({ connectionType: 'oauth' }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'no' },
    });
    const res = await POST(
      makePostRequest({
        connectionType: 'self_authorization',
        refreshToken: 'tok',
      })
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when merchant not found', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    mockGetMerchant.mockResolvedValue(null);
    const res = await POST(
      makePostRequest({
        connectionType: 'self_authorization',
        refreshToken: 'tok',
      })
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when permission denied', async () => {
    setupAuth();
    const { hasPermission } = await import('@/lib/api-auth');
    (hasPermission as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    const res = await POST(
      makePostRequest({
        connectionType: 'self_authorization',
        refreshToken: 'tok',
      })
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid body', async () => {
    setupAuth();
    const res = await POST(
      makePostRequest({ connectionType: 'self_authorization' })
    );
    expect(res.status).toBe(400);
  });

  it('saves integration on self_authorization success', async () => {
    setupAuth();
    mockSelect.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: 'int-1', shop_id: 'default', shop_name: 'My Jumia Shop' },
        error: null,
      }),
    });
    const res = await POST(
      makePostRequest({
        connectionType: 'self_authorization',
        refreshToken: 'tok-abc',
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.integration).toBeDefined();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: MERCHANT_CTX.merchantId,
        refresh_token: 'tok-abc',
        shop_id: 'default',
        platform: 'jumia',
        is_active: true,
      }),
      expect.objectContaining({
        onConflict: 'merchant_id,platform,shop_id',
      })
    );
  });

  it('returns 500 on DB insert error', async () => {
    setupAuth();
    mockSelect.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'unique violation' },
      }),
    });
    const res = await POST(
      makePostRequest({
        connectionType: 'self_authorization',
        refreshToken: 'tok',
      })
    );
    expect(res.status).toBe(500);
  });

  it('returns 500 for oauth when JUMIA_CLIENT_ID is not configured', async () => {
    setupAuth();
    delete process.env.JUMIA_CLIENT_ID;
    const res = await POST(makePostRequest({ connectionType: 'oauth' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Jumia OAuth not configured');
  });

  it('returns 500 for oauth when NEXT_PUBLIC_APP_URL is not configured', async () => {
    setupAuth();
    delete process.env.NEXT_PUBLIC_APP_URL;

    const res = await POST(makePostRequest({ connectionType: 'oauth' }));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Jumia OAuth not configured');
    expect(mockGetJumiaAuthUrl).not.toHaveBeenCalled();
  });

  it('returns 200 with auth URL when OAuth is configured', async () => {
    setupAuth();
    const res = await POST(makePostRequest({ connectionType: 'oauth' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.redirectUrl).toBe('https://jumia.com/auth?state=xyz');
    expect(mockGetJumiaAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/api/marketplace/jumia/callback',
      })
    );
  });
});

describe('Connect GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.JUMIA_CLIENT_ID = 'test-client-id';
    mockGetJumiaAuthUrl.mockReturnValue('https://jumia.com/auth?state=xyz');
    setupAuth();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'no' },
    });

    const res = await GET(makeGetRequest('?connectionType=oauth'));

    expect(res.status).toBe(401);
    expect(mockGetJumiaAuthUrl).not.toHaveBeenCalled();
  });

  it('returns 404 when merchant not found', async () => {
    mockGetMerchant.mockResolvedValue(null);

    const res = await GET(makeGetRequest('?connectionType=oauth'));

    expect(res.status).toBe(404);
    expect(mockGetJumiaAuthUrl).not.toHaveBeenCalled();
  });

  it('returns 403 when permission is denied', async () => {
    const { hasPermission } = await import('@/lib/api-auth');
    (hasPermission as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    const res = await GET(makeGetRequest('?connectionType=oauth'));

    expect(res.status).toBe(403);
    expect(mockGetJumiaAuthUrl).not.toHaveBeenCalled();
  });

  it('returns 500 when JUMIA_CLIENT_ID is not configured', async () => {
    delete process.env.JUMIA_CLIENT_ID;

    const res = await GET(makeGetRequest('?connectionType=oauth'));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Jumia OAuth not configured');
    expect(mockGetJumiaAuthUrl).not.toHaveBeenCalled();
  });

  it('returns 500 for oauth when NEXT_PUBLIC_APP_URL is not configured', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const res = await GET(makeGetRequest('?connectionType=oauth'));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Jumia OAuth not configured');
    expect(mockGetJumiaAuthUrl).not.toHaveBeenCalled();
  });

  it('redirects to Jumia when OAuth is configured', async () => {
    const res = await GET(makeGetRequest('?connectionType=oauth'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://jumia.com/auth?state=xyz'
    );
    expect(mockGetJumiaAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/api/marketplace/jumia/callback',
      })
    );
  });
});
