import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn(),
}));

const { default: LegacyContactPage } = await import('./page');

describe('legacy contact page redirect', () => {
  it('redirects custom-domain traffic to the canonical /contact URL', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyContactPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/contact');
  });
});
