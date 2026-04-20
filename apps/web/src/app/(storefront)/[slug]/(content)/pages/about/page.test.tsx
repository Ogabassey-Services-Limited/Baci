import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn(),
}));

const { default: LegacyAboutPage } = await import('./page');

describe('legacy about page redirect', () => {
  it('redirects custom-domain traffic to the canonical /about URL', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyAboutPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/about');
  });
});
