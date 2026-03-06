import { beforeEach, describe, expect, it, vi } from 'vitest';

const headersMock = vi.fn();
const resolveLegacyProductTargetMock = vi.fn();

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

vi.mock('../../../resolve-legacy-product-target', () => ({
  resolveLegacyProductTarget: resolveLegacyProductTargetMock,
}));

describe('legacy category product metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    headersMock.mockResolvedValue(new Headers([['host', 'ogabassey.com']]));
  });

  it('uses the canonical product URL when a legacy product id resolves', async () => {
    resolveLegacyProductTargetMock.mockResolvedValue('/tablets/ipad-11');

    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        productId: '865',
      }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/tablets/ipad-11'
    );
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it('self-canonicalizes missing legacy category product ids on the current host', async () => {
    resolveLegacyProductTargetMock.mockResolvedValue(null);

    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        productId: '865',
      }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/category/product/865'
    );
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });
});
