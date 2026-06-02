import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetStorefrontShellSnapshotBase, mockIsDomainIdentifier } =
  vi.hoisted(() => ({
    mockGetStorefrontShellSnapshotBase: vi.fn(),
    mockIsDomainIdentifier: vi.fn((value: string) => value.includes('.')),
  }));

vi.mock('@/app/(storefront)/[slug]/storefront-shell-snapshot', () => ({
  getStorefrontShellSnapshotBase: (slug: string) =>
    mockGetStorefrontShellSnapshotBase(slug),
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => mockIsDomainIdentifier(value),
}));

const { resolveLegacyAccountRedirectPath } = await import(
  './legacy-account-redirect'
);

describe('resolveLegacyAccountRedirectPath', () => {
  beforeEach(() => {
    mockGetStorefrontShellSnapshotBase.mockReset();
    mockIsDomainIdentifier.mockReset();
    mockIsDomainIdentifier.mockImplementation((value: string) =>
      value.includes('.')
    );
  });

  it('redirects custom-domain legacy account roots to the account route', async () => {
    mockGetStorefrontShellSnapshotBase.mockResolvedValueOnce({
      basePath: '',
      merchant: { slug: 'ogabassey' },
      routingMode: 'domain',
    });

    await expect(
      resolveLegacyAccountRedirectPath({ slug: 'ogabassey.com' })
    ).resolves.toBe('/account');
  });

  it('preserves slug-prefixed legacy account deep links', async () => {
    mockGetStorefrontShellSnapshotBase.mockResolvedValueOnce(null);
    mockIsDomainIdentifier.mockReturnValueOnce(false);

    await expect(
      resolveLegacyAccountRedirectPath({
        slug: 'demo-store',
        segments: ['orders', 'order 123'],
      })
    ).resolves.toBe('/demo-store/account/orders/order%20123');
  });

  it('preserves legacy account query strings and repeated keys', async () => {
    mockGetStorefrontShellSnapshotBase.mockResolvedValueOnce(null);
    mockIsDomainIdentifier.mockReturnValueOnce(false);

    await expect(
      resolveLegacyAccountRedirectPath({
        slug: 'demo-store',
        segments: ['login'],
        searchParams: {
          empty: '',
          redirect: '/checkout',
          step: ['cart', 'payment'],
          ignored: undefined,
        },
      })
    ).resolves.toBe(
      '/demo-store/account/login?empty=&redirect=%2Fcheckout&step=cart&step=payment'
    );
  });
});
