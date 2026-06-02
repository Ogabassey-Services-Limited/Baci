import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetStorefrontShellSnapshotBase,
  mockIsDomainIdentifier,
  mockRedirect,
} = vi.hoisted(() => ({
  mockGetStorefrontShellSnapshotBase: vi.fn(),
  mockIsDomainIdentifier: vi.fn((value: string) => value.includes('.')),
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('@/app/(storefront)/[slug]/storefront-shell-snapshot', () => ({
  getStorefrontShellSnapshotBase: (slug: string) =>
    mockGetStorefrontShellSnapshotBase(slug),
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => mockIsDomainIdentifier(value),
}));

const { default: MyAccountRedirectPage, unstable_instant } = await import(
  './page'
);

describe('MyAccountRedirectPage', () => {
  beforeEach(() => {
    mockGetStorefrontShellSnapshotBase.mockReset();
    mockIsDomainIdentifier.mockReset();
    mockIsDomainIdentifier.mockImplementation((value: string) =>
      value.includes('.')
    );
    mockRedirect.mockReset();
  });
  it('opts the legacy redirect route out of instant shell validation', () => {
    expect(unstable_instant).toBe(false);
  });

  it('redirects custom-domain requests to the existing account route', async () => {
    mockGetStorefrontShellSnapshotBase.mockResolvedValueOnce({
      basePath: '',
      merchant: { slug: 'ogabassey' },
      routingMode: 'domain',
    });

    await expect(
      MyAccountRedirectPage({
        params: Promise.resolve({ slug: 'ogabassey.com' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/account');

    expect(mockGetStorefrontShellSnapshotBase).toHaveBeenCalledWith(
      'ogabassey.com'
    );
    expect(mockRedirect).toHaveBeenCalledWith('/account');
  });

  it('preserves slug-prefixed storefronts when no request shell is available', async () => {
    mockGetStorefrontShellSnapshotBase.mockResolvedValueOnce(null);
    mockIsDomainIdentifier.mockReturnValueOnce(false);

    await expect(
      MyAccountRedirectPage({
        params: Promise.resolve({ slug: 'demo-store' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/demo-store/account');

    expect(mockRedirect).toHaveBeenCalledWith('/demo-store/account');
  });
});
