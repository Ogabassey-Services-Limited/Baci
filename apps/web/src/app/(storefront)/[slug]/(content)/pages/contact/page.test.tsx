import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn(),
}));

const { default: LegacyContactPage } = await import(
  '@/app/(storefront)/[slug]/(content)/pages/contact/page'
);

describe('legacy contact page redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects custom-domain traffic to the canonical /contact URL', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyContactPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/contact');
  });

  it('redirects non-custom-domain traffic to /:slug/contact', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers());

    await LegacyContactPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/ogabassey/contact');
  });

  it('forwards query params to the destination', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyContactPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ utm_source: 'email' }),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/contact?utm_source=email');
  });
});
