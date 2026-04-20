import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn(),
}));

const { default: LegacyPrivacyPage } = await import('./page');

describe('legacy privacy page redirect', () => {
  it('redirects custom-domain traffic to the canonical /privacy URL', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyPrivacyPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/privacy');
  });
});
