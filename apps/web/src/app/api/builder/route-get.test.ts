import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetBuilderAuthentication = vi.fn();
const mockGetBuilderRequestContext = vi.fn();
const mockLoadBuilderPayload = vi.fn();
const authenticatedBuilderUser = { user: { id: 'user-1' }, supabase: {} };

vi.mock('./builder-load-payload', () => ({
  loadBuilderPayload: mockLoadBuilderPayload,
}));

vi.mock('./builder-request-context', () => ({
  getBuilderAuthentication: mockGetBuilderAuthentication,
  getBuilderRequestContext: mockGetBuilderRequestContext,
}));

describe('/api/builder GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBuilderAuthentication.mockResolvedValue({
      auth: authenticatedBuilderUser,
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
      '11111111-1111-4111-8111-111111111111',
      authenticatedBuilderUser
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
});
