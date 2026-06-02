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

const { default: MyAccountCatchAllRedirectPage, unstable_instant } =
  await import('./page');

describe('MyAccountCatchAllRedirectPage', () => {
  beforeEach(() => {
    mockGetStorefrontShellSnapshotBase.mockReset();
    mockIsDomainIdentifier.mockReset();
    mockIsDomainIdentifier.mockImplementation((value: string) =>
      value.includes('.')
    );
    mockRedirect.mockReset();
  });

  it('opts the legacy catch-all redirect route out of instant shell validation', () => {
    expect(unstable_instant).toBe(false);
  });

  it('redirects custom-domain legacy account deep links', async () => {
    mockGetStorefrontShellSnapshotBase.mockResolvedValueOnce({
      basePath: '',
      merchant: { slug: 'ogabassey' },
      routingMode: 'domain',
    });

    await expect(
      MyAccountCatchAllRedirectPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          path: ['orders'],
        }),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/account/orders');

    expect(mockGetStorefrontShellSnapshotBase).toHaveBeenCalledWith(
      'ogabassey.com'
    );
    expect(mockRedirect).toHaveBeenCalledWith('/account/orders');
  });

  it('preserves slug-prefixed storefronts for legacy account settings', async () => {
    mockGetStorefrontShellSnapshotBase.mockResolvedValueOnce(null);
    mockIsDomainIdentifier.mockReturnValueOnce(false);

    await expect(
      MyAccountCatchAllRedirectPage({
        params: Promise.resolve({
          slug: 'demo-store',
          path: ['settings'],
        }),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/demo-store/account/settings');

    expect(mockRedirect).toHaveBeenCalledWith('/demo-store/account/settings');
  });
});
