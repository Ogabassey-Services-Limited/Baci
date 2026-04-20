import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn(),
}));

const { default: LegacyTermsPage } = await import(
  '@/app/(storefront)/[slug]/(content)/pages/terms/page'
);

describe('legacy terms page redirect', () => {
  it('redirects custom-domain traffic to the canonical /terms URL', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyTermsPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/terms');
  });

  it('redirects non-custom-domain traffic to /:slug/terms', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers());

    await LegacyTermsPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/ogabassey/terms');
  });

  it('forwards query params to the destination', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyTermsPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ utm_source: 'email' }),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/terms?utm_source=email');
  });
});
