import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockGetBuilderAuthentication = vi.fn();
const mockGetBuilderRequestContext = vi.fn();
const mockLoadBuilderPayload = vi.fn();
const mockSaveBuilderDraft = vi.fn();
const mockPublishBuilderDraft = vi.fn();

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mockCheckCsrfProtection,
}));

vi.mock('./builder-route-utils', () => ({
  getBuilderAuthentication: mockGetBuilderAuthentication,
  getBuilderRequestContext: mockGetBuilderRequestContext,
  loadBuilderPayload: mockLoadBuilderPayload,
  saveBuilderDraft: mockSaveBuilderDraft,
  publishBuilderDraft: mockPublishBuilderDraft,
}));

describe('/api/builder route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockGetBuilderAuthentication.mockResolvedValue({
      auth: { user: { id: 'user-1' }, supabase: {} },
    });
    mockGetBuilderRequestContext.mockResolvedValue({
      context: {
        merchantId: 'merchant-1',
        supabase: {},
        canEdit: true,
      },
    });
  });

  it('returns the builder payload from the loader helper', async () => {
    mockLoadBuilderPayload.mockResolvedValue({
      data: {
        config: { content: [], root: { title: 'Home' }, zones: {} },
        seo: null,
        storeSettings: null,
        setupSettings: null,
        publishedConfig: null,
        isPublished: false,
        isDefault: true,
        lastUpdated: null,
        degraded: false,
        degradedReason: null,
        canEdit: true,
        previewMode: null,
        aiDraftJobId: null,
        canApplyAiDraft: true,
      },
    });

    const request = new NextRequest(
      'http://localhost/api/builder?slug=home&merchantId=11111111-1111-4111-8111-111111111111'
    );

    const { GET } = await import('./route');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.canEdit).toBe(true);
    expect(body.degraded).toBe(false);
    expect(mockGetBuilderRequestContext).toHaveBeenCalledWith(
      request,
      'view',
      '11111111-1111-4111-8111-111111111111'
    );
    expect(mockLoadBuilderPayload).toHaveBeenCalledWith(
      {},
      'merchant-1',
      'home',
      true,
      undefined
    );
  });

  it('passes the AI draft preview job id into the loader helper', async () => {
    const aiDraftJobId = '5c0a0676-bd3f-495e-9f98-589f208c0d79';
    mockLoadBuilderPayload.mockResolvedValue({
      data: {
        config: { content: [], root: { title: 'Home' }, zones: {} },
        seo: null,
        storeSettings: null,
        setupSettings: null,
        publishedConfig: null,
        isPublished: false,
        isDefault: false,
        lastUpdated: '2026-04-28T10:00:00.000Z',
        degraded: false,
        degradedReason: null,
        canEdit: false,
        previewMode: 'ai_draft',
        aiDraftJobId,
        canApplyAiDraft: true,
      },
    });

    const request = new NextRequest(
      `http://localhost/api/builder?slug=home&merchantId=11111111-1111-4111-8111-111111111111&aiDraftJobId=${aiDraftJobId}`
    );

    const { GET } = await import('./route');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.previewMode).toBe('ai_draft');
    expect(mockLoadBuilderPayload).toHaveBeenCalledWith(
      {},
      'merchant-1',
      'home',
      true,
      aiDraftJobId
    );
  });

  it('rejects malformed AI draft preview job ids without loading a merchant config', async () => {
    const request = new NextRequest(
      'http://localhost/api/builder?slug=home&merchantId=11111111-1111-4111-8111-111111111111&aiDraftJobId=not-a-uuid'
    );

    const { GET } = await import('./route');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request query');
    expect(mockGetBuilderRequestContext).not.toHaveBeenCalled();
    expect(mockLoadBuilderPayload).not.toHaveBeenCalled();
  });

  it('returns 401 for an unauthenticated malformed GET before validating its query', async () => {
    mockGetBuilderAuthentication.mockResolvedValue({
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const request = new NextRequest(
      'http://localhost/api/builder?merchantId=not-a-uuid'
    );

    const { GET } = await import('./route');
    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(mockGetBuilderRequestContext).not.toHaveBeenCalled();
  });

  it('returns the helper response when builder context fails', async () => {
    mockGetBuilderRequestContext.mockResolvedValue({
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    });

    const request = new NextRequest(
      'http://localhost/api/builder?slug=home&merchantId=11111111-1111-4111-8111-111111111111'
    );

    const { GET } = await import('./route');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden' });
    expect(mockLoadBuilderPayload).not.toHaveBeenCalled();
  });

  it('returns the loader response directly when loading the builder fails', async () => {
    mockLoadBuilderPayload.mockResolvedValue({
      response: NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      ),
    });

    const request = new NextRequest(
      'http://localhost/api/builder?slug=home&merchantId=11111111-1111-4111-8111-111111111111'
    );

    const { GET } = await import('./route');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Merchant not found' });
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
    expect(mockSaveBuilderDraft).not.toHaveBeenCalled();
  });

  it('returns 401 for an unauthenticated malformed POST before validating its body', async () => {
    mockGetBuilderAuthentication.mockResolvedValue({
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const request = new NextRequest('http://localhost/api/builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    });

    const { POST } = await import('./route');
    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mockGetBuilderRequestContext).not.toHaveBeenCalled();
  });

  it('returns the saved draft payload from the helper', async () => {
    mockSaveBuilderDraft.mockResolvedValue({
      data: {
        id: 'config-1',
        updated_at: '2026-03-20T18:00:00.000Z',
      },
      lastUpdated: '2026-03-20T18:00:00.000Z',
    });

    const request = new NextRequest('http://localhost/api/builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'home',
        merchantId: '11111111-1111-4111-8111-111111111111',
        config: { content: [], root: { title: 'Home' }, zones: {} },
        expectedLastUpdated: null,
      }),
    });

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetBuilderRequestContext).toHaveBeenCalledWith(
      request,
      'edit',
      '11111111-1111-4111-8111-111111111111'
    );
    expect(body).toEqual({
      success: true,
      data: {
        id: 'config-1',
        updated_at: '2026-03-20T18:00:00.000Z',
      },
      lastUpdated: '2026-03-20T18:00:00.000Z',
    });
  });

  it('returns the helper response when save detects a conflict', async () => {
    mockSaveBuilderDraft.mockResolvedValue({
      response: NextResponse.json(
        {
          error: 'Builder draft is out of date',
          code: 'stale_builder_draft',
        },
        { status: 409 }
      ),
    });

    const request = new NextRequest('http://localhost/api/builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'home',
        merchantId: '11111111-1111-4111-8111-111111111111',
        config: { content: [], root: { title: 'Home' }, zones: {} },
        expectedLastUpdated: '2026-03-20T18:00:00.000Z',
      }),
    });

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('stale_builder_draft');
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

  it('returns 401 for an unauthenticated malformed PUT before validating its body', async () => {
    mockGetBuilderAuthentication.mockResolvedValue({
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const request = new NextRequest('http://localhost/api/builder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    });

    const { PUT } = await import('./route');
    const response = await PUT(request);

    expect(response.status).toBe(401);
    expect(mockGetBuilderRequestContext).not.toHaveBeenCalled();
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
    expect(mockPublishBuilderDraft).not.toHaveBeenCalled();
  });

  it('returns the publish helper response', async () => {
    mockPublishBuilderDraft.mockResolvedValue({
      data: { id: 'config-1' },
      lastUpdated: '2026-03-20T18:05:00.000Z',
    });

    const request = new NextRequest('http://localhost/api/builder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'home',
        merchantId: '11111111-1111-4111-8111-111111111111',
        expectedLastUpdated: '2026-03-20T18:00:00.000Z',
      }),
    });

    const { PUT } = await import('./route');
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetBuilderRequestContext).toHaveBeenCalledWith(
      request,
      'edit',
      '11111111-1111-4111-8111-111111111111'
    );
    expect(body).toEqual({
      success: true,
      lastUpdated: '2026-03-20T18:05:00.000Z',
    });
  });
});
