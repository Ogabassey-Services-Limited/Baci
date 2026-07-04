import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

const mockPurgeCloudflareUrls = vi.fn();
const mockAfter = vi.fn((callback: () => unknown) => {
  callback();
});

vi.mock('next/server', () => ({
  after: (callback: () => unknown) => mockAfter(callback),
}));
vi.mock('@/lib/cloudflare-purge', () => ({
  purgeCloudflareUrls: (...args: unknown[]) => mockPurgeCloudflareUrls(...args),
}));
// Keep the real URL builder (so purge-URL assertions run against real output)
// but make it spy-able so one test can force it to throw.
vi.mock('@/lib/storefront-purge-urls', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/storefront-purge-urls')>();
  return {
    ...actual,
    buildStorefrontProductPurgeUrls: vi.fn(
      actual.buildStorefrontProductPurgeUrls
    ),
  };
});

import { buildStorefrontProductPurgeUrls } from '@/lib/storefront-purge-urls';
// ---- Import function AFTER mocks ----
import { scheduleStorefrontProductPurge } from './storefront-product-purge';

// ---- Tests ----

describe('scheduleStorefrontProductPurge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('schedules a purge of the built URLs via after()', () => {
    scheduleStorefrontProductPurge('ogabassey', [
      { slug: 'iphone-15', categorySegment: 'smartphones' },
    ]);

    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockPurgeCloudflareUrls).toHaveBeenCalledWith([
      'https://ogabassey.com/',
      'https://ogabassey.com/products',
      'https://ogabassey.com/smartphones/iphone-15',
      'https://ogabassey.com/products/iphone-15',
      'https://ogabassey.com/smartphones',
      'https://www.ogabassey.com/',
      'https://www.ogabassey.com/products',
      'https://www.ogabassey.com/smartphones/iphone-15',
      'https://www.ogabassey.com/products/iphone-15',
      'https://www.ogabassey.com/smartphones',
    ]);
  });

  it('does not schedule a purge for a missing identifier', () => {
    scheduleStorefrontProductPurge(undefined, [{ slug: 'iphone-15' }]);
    scheduleStorefrontProductPurge('   ', [{ slug: 'iphone-15' }]);

    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockPurgeCloudflareUrls).not.toHaveBeenCalled();
  });

  it('does not schedule a purge when there are no entries', () => {
    scheduleStorefrontProductPurge('ogabassey', []);

    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockPurgeCloudflareUrls).not.toHaveBeenCalled();
  });

  it('does not schedule a purge for a storefront without a public cache policy', () => {
    scheduleStorefrontProductPurge('some-other-store', [
      { slug: 'iphone-15', categorySegment: 'smartphones' },
    ]);

    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockPurgeCloudflareUrls).not.toHaveBeenCalled();
  });

  it('detaches the purge when there is no request scope for after()', () => {
    mockAfter.mockImplementationOnce(() => {
      throw new Error('after() called outside a request scope');
    });

    scheduleStorefrontProductPurge('ogabassey', [
      { slug: 'iphone-15', categorySegment: 'smartphones' },
    ]);

    // Falls back to a detached purge instead of throwing.
    expect(mockPurgeCloudflareUrls).toHaveBeenCalledTimes(1);
  });

  it('never throws when the purge URL build fails', () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    vi.mocked(buildStorefrontProductPurgeUrls).mockImplementationOnce(() => {
      throw new Error('purge URL build failed');
    });

    expect(() =>
      scheduleStorefrontProductPurge('ogabassey', [
        { slug: 'iphone-15', categorySegment: 'smartphones' },
      ])
    ).not.toThrow();

    expect(mockPurgeCloudflareUrls).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'Skipped Cloudflare product purge scheduling',
      { error: expect.any(Error) }
    );
    warnSpy.mockRestore();
  });
});
