import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConnection = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('next/server', () => ({
  connection: () => mockConnection(),
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn(),
}));

const { default: LegacyTermsOfServicePage } = await import('./page');

describe('legacy terms-of-service redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnection.mockReset();
  });

  it('redirects custom-domain traffic to the canonical /terms URL', async () => {
    mockConnection.mockResolvedValueOnce(undefined);
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyTermsOfServicePage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/terms');
    expect(mockConnection).toHaveBeenCalledOnce();
  });

  it('redirects non-custom-domain traffic with slug prefix', async () => {
    mockConnection.mockResolvedValueOnce(undefined);
    vi.mocked(headers).mockResolvedValue(new Headers());

    await LegacyTermsOfServicePage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/ogabassey/terms');
    expect(mockConnection).toHaveBeenCalledOnce();
  });

  it('forwards query params to the destination', async () => {
    mockConnection.mockResolvedValueOnce(undefined);
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyTermsOfServicePage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ utm_source: 'email' }),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/terms?utm_source=email');
    expect(mockConnection).toHaveBeenCalledOnce();
  });

  it('surfaces connection failures to the route boundary', async () => {
    mockConnection.mockRejectedValueOnce(new Error('Connection failed'));
    vi.mocked(headers).mockResolvedValue(new Headers());

    await expect(
      LegacyTermsOfServicePage({
        params: Promise.resolve({ slug: 'ogabassey' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('Connection failed');

    expect(permanentRedirect).not.toHaveBeenCalled();
    expect(mockConnection).toHaveBeenCalledOnce();
  });
});
