import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCategoryCompareHubStatus } from '@/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/resolve-category-compare-hub-status';
import { GET } from './route';

const { mockGetInternalApiSecret } = vi.hoisted(() => ({
  mockGetInternalApiSecret: vi.fn(() => 'test-internal-secret'),
}));

vi.mock('@/env', () => ({
  getInternalApiSecret: () => mockGetInternalApiSecret(),
}));

vi.mock(
  '@/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/resolve-category-compare-hub-status',
  () => ({
    resolveCategoryCompareHubStatus: vi.fn(),
  })
);

function buildRequest(
  query: string,
  headers: Record<string, string> = {
    'x-baci-internal-auth': 'test-internal-secret',
  }
) {
  const request = new NextRequest(
    `https://usebaci.com/api/internal/compare-hub-status/ogabassey?${query}`
  );
  for (const [name, value] of Object.entries(headers)) {
    request.headers.set(name, value);
  }
  return request;
}

function context(identifier = 'ogabassey') {
  return { params: Promise.resolve({ identifier }) };
}

describe('GET /api/internal/compare-hub-status/[identifier]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInternalApiSecret.mockReturnValue('test-internal-secret');
    vi.mocked(resolveCategoryCompareHubStatus).mockResolvedValue({
      kind: 'renderable',
    });
  });

  it('returns 500 when the internal secret is not configured', async () => {
    mockGetInternalApiSecret.mockReturnValue('');

    const response = await GET(buildRequest('category=smartphones'), context());

    expect(response.status).toBe(500);
    expect(resolveCategoryCompareHubStatus).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests before resolving status', async () => {
    const response = await GET(
      buildRequest('category=smartphones', {
        'x-baci-internal-auth': 'wrong',
      }),
      context()
    );

    expect(response.status).toBe(401);
    expect(resolveCategoryCompareHubStatus).not.toHaveBeenCalled();
  });

  it('returns 400 when the category query param is missing', async () => {
    const response = await GET(buildRequest(''), context());

    expect(response.status).toBe(400);
    expect(resolveCategoryCompareHubStatus).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid route identifier', async () => {
    const response = await GET(
      buildRequest('category=smartphones'),
      context('   ')
    );

    expect(response.status).toBe(400);
    expect(resolveCategoryCompareHubStatus).not.toHaveBeenCalled();
  });

  it('resolves a renderable hub and edge-caches the safe verdict under custom-header auth', async () => {
    const response = await GET(buildRequest('category=smartphones'), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      empty: false,
      hasError: false,
    });
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=300');
    expect(response.headers.get('Vary')).toBe('x-baci-internal-auth');
    expect(resolveCategoryCompareHubStatus).toHaveBeenCalledWith({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
    });
  });

  it('keeps the renderable verdict no-store under legacy Bearer auth', async () => {
    const response = await GET(
      buildRequest('category=smartphones', {
        Authorization: 'Bearer test-internal-secret',
      }),
      context()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('keeps the EMPTY verdict no-store so a hub that gains products is never sticky-404ed', async () => {
    vi.mocked(resolveCategoryCompareHubStatus).mockResolvedValue({
      kind: 'empty',
    });

    const response = await GET(buildRequest('category=printers'), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      empty: true,
      hasError: false,
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('fails open (empty=false, hasError=true) when the resolver throws', async () => {
    vi.mocked(resolveCategoryCompareHubStatus).mockRejectedValue(
      new Error('inventory query failed')
    );

    const response = await GET(buildRequest('category=smartphones'), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      empty: false,
      hasError: true,
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
