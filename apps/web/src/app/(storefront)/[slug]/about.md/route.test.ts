import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMerchantByIdentifier = vi.fn();
const buildStorefrontAboutMarkdown = vi.fn();
const markdownResponse = vi.fn();
const notFoundMarkdownResponse = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier,
}));

vi.mock('@/lib/llms-markdown', () => ({
  buildStorefrontAboutMarkdown,
  markdownResponse,
  notFoundMarkdownResponse,
}));

describe('GET /about.md', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    markdownResponse.mockImplementation(
      (body: string) =>
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
        })
    );
    notFoundMarkdownResponse.mockImplementation(
      (body: string) =>
        new Response(body, {
          status: 404,
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
        })
    );
  });

  it('returns not found when the merchant is missing', async () => {
    getMerchantByIdentifier.mockResolvedValue(null);

    const { GET } = await import('./route');
    const response = await GET(new Request('https://ogabassey.com/about.md'), {
      params: Promise.resolve({ slug: 'ogabassey.com' }),
    });
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(body).toContain('# Not Found');
  });

  it('returns about markdown when about content is present', async () => {
    getMerchantByIdentifier.mockResolvedValue({
      id: 'm1',
      business_name: 'Ogabassey',
      slug: 'ogabassey',
      about_page: 'We sell gadgets.',
    });
    buildStorefrontAboutMarkdown.mockReturnValue('# About\n');

    const { GET } = await import('./route');
    const response = await GET(new Request('https://ogabassey.com/about.md'), {
      params: Promise.resolve({ slug: 'ogabassey.com' }),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(buildStorefrontAboutMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: 'Ogabassey',
        about_page: 'We sell gadgets.',
      }),
      'https://ogabassey.com'
    );
    expect(markdownResponse).toHaveBeenCalledWith('# About\n');
    expect(body).toBe('# About\n');
  });
});
