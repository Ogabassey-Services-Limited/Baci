import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn(),
}));

const { default: LegacyTermsOfServicePage } = await import('./page');

describe('legacy terms-of-service redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects custom-domain traffic to the canonical /terms URL', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyTermsOfServicePage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/terms');
  });

  it('redirects non-custom-domain traffic with slug prefix', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers());

    await LegacyTermsOfServicePage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/ogabassey/terms');
  });

  it('forwards query params to the destination', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyTermsOfServicePage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ utm_source: 'email' }),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/terms?utm_source=email');
  });
});
