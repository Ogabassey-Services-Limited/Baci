import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn(),
}));

const { default: LegacyTermsPage } = await import('./page');

describe('legacy terms page redirect', () => {
  it('redirects custom-domain traffic to the canonical /terms URL', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyTermsPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/terms');
  });
});
