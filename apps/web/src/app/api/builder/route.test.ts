import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockGetAuthenticatedUser = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();
const mockGenerateDefaultConfig = vi.fn();

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mockCheckCsrfProtection,
}));

vi.mock('@/lib/supabase/mobile-auth', () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mockGetMerchantForApiRequest,
  toUserAccess: vi.fn(() => ({ role: 'owner' })),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: mockHasPermission,
}));

vi.mock('@/lib/builder-defaults', () => ({
  generateDefaultConfig: mockGenerateDefaultConfig,
}));

describe('/api/builder route', () => {
  const mockSupabase = {
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: mockSupabase,
    });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      role: 'owner',
    });
    mockHasPermission.mockReturnValue(true);
    mockGenerateDefaultConfig.mockResolvedValue({ content: [] });
  });

  it('returns the CSRF response before handling POST mutations', async () => {
    mockCheckCsrfProtection.mockResolvedValue({
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
    });

    const request = new NextRequest('http://localhost/api/builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'home', config: { content: [] } }),
    });

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Invalid CSRF token' });
  });

  it('returns 400 when the POST payload fails validation', async () => {
    const request = new NextRequest('http://localhost/api/builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'home' }),
    });

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 401 before parsing malformed POST JSON when unauthenticated', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    });

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 200 and persists the draft on a valid POST payload', async () => {
    const upsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'config-1',
            merchant_id: 'merchant-1',
            page_slug: 'home',
            draft_config: { content: [] },
            draft_seo: { title: 'Home' },
            draft_store_settings: { layout: 'grid' },
            draft_setup_settings: { ready: true },
            updated_at: '2026-03-08T00:00:00.000Z',
          },
          error: null,
        }),
      }),
    });
    mockSupabase.from.mockReturnValue({ upsert });

    const request = new NextRequest('http://localhost/api/builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'home',
        config: { content: [] },
        name: 'Home',
        seo: { title: 'Home' },
        storeSettings: { layout: 'grid' },
        setupSettings: { ready: true },
      }),
    });

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        id: 'config-1',
        merchant_id: 'merchant-1',
        page_slug: 'home',
        draft_config: { content: [] },
        draft_seo: { title: 'Home' },
        draft_store_settings: { layout: 'grid' },
        draft_setup_settings: { ready: true },
        updated_at: '2026-03-08T00:00:00.000Z',
      },
    });
    expect(mockSupabase.from).toHaveBeenCalledWith('page_configs');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-1',
        page_slug: 'home',
        page_name: 'Home',
        draft_config: { content: [] },
        draft_seo: { title: 'Home' },
        draft_store_settings: { layout: 'grid' },
        draft_setup_settings: { ready: true },
      }),
      { onConflict: 'merchant_id,page_slug' }
    );
  });

  it('returns 400 when the PUT body is malformed JSON', async () => {
    const request = new NextRequest('http://localhost/api/builder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    });

    const { PUT } = await import('./route');
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid JSON body' });
  });

  it('returns 400 when the PUT payload fails validation', async () => {
    const request = new NextRequest('http://localhost/api/builder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: '   ' }),
    });

    const { PUT } = await import('./route');
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request body');
  });
});
