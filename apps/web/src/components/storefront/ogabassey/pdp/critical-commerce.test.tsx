import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OgabasseyPdpCriticalCommerce } from './critical-commerce';

vi.mock('./critical-commerce.client', () => ({
  OgabasseyPdpCriticalCommerceConditionFact: ({
    fallbackCondition,
  }: {
    fallbackCondition?: string | null;
  }) =>
    fallbackCondition ? (
      <>
        <dt>Condition</dt>
        <dd>{fallbackCondition === 'open_box' ? 'Open Box' : 'Used'}</dd>
      </>
    ) : null,
  OgabasseyPdpCriticalCommerceControls: () => (
    <button type="button">Add to cart</button>
  ),
}));

const criticalProduct = {
  brand: 'Dell',
  categoryName: 'Laptops',
  categorySlug: 'laptops',
  condition: 'used',
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/alienware.avif',
  name: 'Dell Alienware m18 R3 (RTX 5080)',
  price: 7_098_000,
  slug: 'dell-alienware-m18-r3-rtx-5080',
  stockQuantity: 4,
  variantCount: 1,
};

describe('OgabasseyPdpCriticalCommerce', () => {
  it('renders static commerce facts before the client controls hydrate', () => {
    render(
      <OgabasseyPdpCriticalCommerce
        cartHref="/cart"
        product={criticalProduct}
      />
    );

    expect(screen.getByText('Ready to buy')).toBeInTheDocument();
    expect(screen.getByText('Used')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add to cart/i })
    ).toBeInTheDocument();
  });

  it('omits the condition fact when the product condition is missing', () => {
    const productWithoutCondition = {
      ...criticalProduct,
      condition: undefined,
    } as unknown as typeof criticalProduct;

    render(
      <OgabasseyPdpCriticalCommerce
        cartHref="/cart"
        product={productWithoutCondition}
      />
    );

    expect(screen.queryByText('Condition')).not.toBeInTheDocument();
    expect(screen.getByText('Lagos and nationwide')).toBeInTheDocument();
  });

  it('formats underscored product conditions for display', () => {
    render(
      <OgabasseyPdpCriticalCommerce
        cartHref="/cart"
        product={{
          ...criticalProduct,
          condition: 'open_box',
        }}
      />
    );

    expect(screen.getByText('Open Box')).toBeInTheDocument();
    expect(screen.queryByText('Open_box')).not.toBeInTheDocument();
  });
});
