import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockHeaders = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockSelect = vi.fn();
const mockNot = vi.fn();
const mockOrder = vi.fn();

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

describe('root sitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockHeaders.mockResolvedValue(new Headers([['host', 'usebaci.com']]));

    mockOrder.mockResolvedValue({
      data: [
        {
          slug: 'ogabassey',
          updated_at: '2026-04-21T12:00:00.000Z',
        },
      ],
      error: null,
    });

    mockNot.mockReturnValue({
      order: mockOrder,
    });

    mockSelect.mockReturnValue({
      not: mockNot,
    });

    mockCreateAdminClient.mockReturnValue({
      from: () => ({
        select: mockSelect,
      }),
    });
  });

  it('includes crawlable platform pages and excludes auth-only routes', async () => {
    const { default: sitemap } = await import('./sitemap');

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).toContain('https://usebaci.com/');
    expect(urls).toContain('https://usebaci.com/pricing');
    expect(urls).toContain('https://usebaci.com/features');
    expect(urls).toContain('https://usebaci.com/blog');

    expect(urls).not.toContain('https://usebaci.com/login');
    expect(urls).not.toContain('https://usebaci.com/onboarding');
    expect(urls).not.toContain('https://usebaci.com/dashboard');
  });

  it('includes storefront discovery URLs for active merchants', async () => {
    const { default: sitemap } = await import('./sitemap');

    const result = await sitemap();

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://usebaci.com/ogabassey',
          changeFrequency: 'daily',
          lastModified: new Date('2026-04-21T12:00:00.000Z'),
          priority: 0.6,
        }),
      ])
    );
  });
});
