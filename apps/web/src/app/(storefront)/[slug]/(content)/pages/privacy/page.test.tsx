import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn(),
}));

const { default: LegacyPrivacyPage } = await import(
  '@/app/(storefront)/[slug]/(content)/pages/privacy/page'
);

describe('legacy privacy page redirect', () => {
  it('redirects custom-domain traffic to the canonical /privacy URL', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyPrivacyPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/privacy');
  });

  it('redirects non-custom-domain traffic to /:slug/privacy', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers());

    await LegacyPrivacyPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/ogabassey/privacy');
  });

  it('forwards query params to the destination', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyPrivacyPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ utm_source: 'email' }),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/privacy?utm_source=email');
  });
});
