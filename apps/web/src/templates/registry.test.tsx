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
