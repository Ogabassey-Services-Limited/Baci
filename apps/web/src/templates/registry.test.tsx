import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockOgabasseyHomePage = vi.fn(
  ({
    storeSlug,
  }: {
    storeSlug?: string;
  }) => <div data-testid="ogabassey-home">{storeSlug}</div>
);

vi.mock('@/components/storefront/ogabassey/pages/home', () => ({
  OgabasseyHomePage: (props: { storeSlug?: string }) =>
    mockOgabasseyHomePage(props),
}));

vi.mock('@/components/storefront/ogabassey/home-product-feed', () => ({
  mapStorefrontProductsToOgabasseyProducts: (products: unknown[]) => products,
}));

vi.mock('@/components/storefront/ogabassey/pages/about-us', () => ({
  OgabasseyV2AboutUs: () => null,
}));
vi.mock('@/components/storefront/ogabassey/pages/privacy-policy', () => ({
  OgabasseyV2PrivacyPolicy: () => null,
}));
vi.mock('@/components/storefront/ogabassey/pages/legal-dispute', () => ({
  OgabasseyV2LegalDispute: () => null,
}));
vi.mock('@/components/storefront/ogabassey/pages/sustainability', () => ({
  OgabasseyV2Sustainability: () => null,
}));
vi.mock('@/components/storefront/ogabassey/pages/repairs', () => ({
  OgabasseyV2Repairs: () => null,
}));
vi.mock('@/components/storefront/ogabassey/pages/swap', () => ({
  OgabasseyV2Swap: () => null,
}));
vi.mock('@/components/storefront/ogabassey/pages/help-support', () => ({
  OgabasseyV2HelpSupport: () => null,
}));
vi.mock('@/components/storefront/ogabassey/pages/blog', () => ({
  OgabasseyV2Blog: () => null,
}));

import { getTemplate } from './registry';

describe('template registry', () => {
  it('loads Ogabassey components without exposing an unused layout wrapper', async () => {
    const template = getTemplate('ogabassey');

    expect(template).toBeDefined();

    const components = await template!.getComponents();

    expect(components.Home).toBeDefined();
    expect(components.Layout).toBeUndefined();
  });

  it('preserves the store slug when rendering the Ogabassey home wrapper', async () => {
    const template = getTemplate('ogabassey');
    const components = await template!.getComponents();

    render(<components.Home storeSlug="ogabassey" products={[]} />);

    expect(screen.getByTestId('ogabassey-home')).toHaveTextContent(
      'ogabassey'
    );
  });
});
