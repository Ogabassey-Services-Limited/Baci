import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockEnsurePermission = vi.fn();
const mockGetSeoStatus = vi.fn();
const mockGetReadiness = vi.fn();
const mockReadinessCard = vi.fn((_props: unknown) => <div>Readiness card</div>);

vi.mock('@/lib/merchant-server', () => ({
  ensurePermission: (...args: unknown[]) => mockEnsurePermission(...args),
}));
vi.mock('./actions', () => ({
  getSEOStatus: (...args: unknown[]) => mockGetSeoStatus(...args),
}));
vi.mock('./get-storefront-search-readiness', () => ({
  getStorefrontSearchReadiness: (...args: unknown[]) =>
    mockGetReadiness(...args),
}));
vi.mock('./seo-client', () => ({
  default: () => <div>SEO client</div>,
}));
vi.mock('./storefront-search-readiness-card', () => ({
  StorefrontSearchReadinessCard: (props: unknown) => mockReadinessCard(props),
}));

const { default: SEOOptimizerPage } = await import('./page');

describe('SEO dashboard readiness integration', () => {
  it('renders the authenticated merchant readiness findings', async () => {
    mockEnsurePermission.mockResolvedValue({ merchant: { id: 'merchant-1' } });
    mockGetSeoStatus.mockResolvedValue({ products: [], summary: null });
    mockGetReadiness.mockResolvedValue({
      tier: 'blocked',
      blockers: [{ code: 'home_not_indexable', href: '/dashboard/settings' }],
      improvements: [
        { code: 'empty_active_catalog', href: '/dashboard/products' },
      ],
    });

    render(await SEOOptimizerPage());

    expect(mockGetReadiness).toHaveBeenCalledWith('merchant-1');
    expect(screen.getByText('Readiness card')).toBeInTheDocument();
    expect(mockReadinessCard).toHaveBeenCalledWith(
      expect.objectContaining({
        assessment: expect.objectContaining({ tier: 'blocked' }),
      })
    );
  });
});
