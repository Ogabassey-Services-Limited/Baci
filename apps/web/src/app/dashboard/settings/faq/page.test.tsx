import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetCachedMerchant = vi.hoisted(() => vi.fn());
const mockGetCachedProducts = vi.hoisted(() => vi.fn());
const mockEnsurePermission = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: mockGetCachedMerchant,
  getCachedProducts: mockGetCachedProducts,
}));

vi.mock('@/lib/merchant-server', () => ({
  ensurePermission: mockEnsurePermission,
}));

vi.mock('./client', () => ({
  FAQSettingsClient: ({
    sampleProducts,
  }: {
    sampleProducts: Array<{
      category?: string;
      name: string;
      price?: number | null;
    }>;
  }) => (
    <section aria-label="FAQ sample products">
      {sampleProducts.map((product) => (
        <p key={product.name}>
          {product.name}|{product.category ?? 'no category'}|
          {product.price ?? 'no price'}
        </p>
      ))}
    </section>
  ),
}));

import FAQSettingsPage from './page';

describe('FAQSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsurePermission.mockResolvedValue({
      merchant: { slug: 'merchant-store' },
    });
    mockGetCachedMerchant.mockResolvedValue({
      id: 'merchant-1',
      slug: 'merchant-store',
    });
  });

  it('renders sample products for FAQ generation', async () => {
    mockGetCachedProducts.mockResolvedValue([
      {
        base_price: 125_000,
        name: 'Sample Phone',
        product_categories: [{ categories: { name: 'Smartphones' } }],
      },
    ]);

    render(await FAQSettingsPage());

    expect(
      screen.getByText('Sample Phone|Smartphones|125000')
    ).toBeInTheDocument();
    expect(mockGetCachedProducts).toHaveBeenCalledWith('merchant-1', {
      includeVariants: false,
      limit: 10,
    });
  });

  it('keeps the FAQ settings page available when sample products fail to load', async () => {
    mockGetCachedProducts.mockRejectedValue(new Error('database unavailable'));

    render(await FAQSettingsPage());

    expect(
      screen.getByRole('region', { name: 'FAQ sample products' })
    ).toBeEmptyDOMElement();
  });
});
