import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn(),
}));

const { default: LegacyFaqPage } = await import('./page');

describe('legacy faq page redirect', () => {
  it('redirects custom-domain traffic to the canonical /faq URL', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyFaqPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/faq');
  });

  it('redirects non-custom-domain traffic to /:slug/faq', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers());

    await LegacyFaqPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/ogabassey/faq');
  });
});
