import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn(),
}));

const { default: LegacyPrivacyPolicyPage } = await import('./page');

describe('legacy privacy-policy redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects custom-domain traffic to the canonical /privacy URL', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyPrivacyPolicyPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/privacy');
  });

  it('redirects non-custom-domain traffic with slug prefix', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers());

    await LegacyPrivacyPolicyPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/ogabassey/privacy');
  });

  it('forwards query params to the destination', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyPrivacyPolicyPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ utm_source: 'email' }),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/privacy?utm_source=email');
  });
});
