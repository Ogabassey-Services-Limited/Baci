// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockHost = 'ogabassey.com';
let mockBlogEnabled = true;
const CONTENT_SIGNAL_DIRECTIVE =
  'Content-Signal: ai-train=no, search=yes, ai-input=yes';

vi.mock('next/headers', () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: vi.fn((name: string) => {
        if (name === 'host') return mockHost;
        return null;
      }),
    })
  ),
}));

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: vi.fn(async () => ({ id: 'merchant-1' })),
  getCachedFeatureSettings: vi.fn(async () => ({
    blog_enabled: mockBlogEnabled,
  })),
}));

vi.mock('@/lib/storefront-route-identifier', () => ({
  resolveRouteIdentifier: vi.fn(() => 'ogabassey'),
}));

function expectContentSignalAfterUserAgent(body: string): void {
  expect(body).toContain(`User-Agent: *\n${CONTENT_SIGNAL_DIRECTIVE}`);
}

describe('GET /api/robots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.doUnmock('@/app/robots');
    mockHost = 'ogabassey.com';
    mockBlogEnabled = true;
  });

  it('serializes robots.txt with AI content usage preferences', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=300, s-maxage=300'
    );
    expect(body).toContain('User-Agent: *');
    expectContentSignalAfterUserAgent(body);
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Sitemap: https://ogabassey.com/sitemap/static.xml');
  });

  it('returns a safe fallback when the robots provider fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.doMock('@/app/robots', () => ({
      default: vi.fn(() => Promise.reject(new Error('robots failed'))),
    }));

    try {
      const { GET } = await import('./route');
      const response = await GET();
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/plain');
      expect(response.headers.get('cache-control')).toBe(
        'public, max-age=300, s-maxage=300'
      );
      expect(body).toContain('User-Agent: *');
      expectContentSignalAfterUserAgent(body);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('serializes minimal configs without a sitemap', async () => {
    vi.doMock('@/app/robots', () => ({
      default: vi.fn(async () => ({
        rules: {
          userAgent: '*',
          allow: '/',
          disallow: '/private/',
        },
      })),
    }));

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('User-Agent: *');
    expectContentSignalAfterUserAgent(body);
    expect(body).toContain('Allow: /');
    expect(body).toContain('Disallow: /private/');
    expect(body).not.toContain('Sitemap:');
  });
});
