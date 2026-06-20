import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  getRenderableCriticalVariantAxes,
  OgabasseyPdpCriticalVariantSelectors,
} from './critical-variant-selectors.client';

const variants = [
  {
    attributes: { color: 'Graphite', ram: '4GB', storage: '128GB' },
    id: 'variant-128-4',
    merchant_id: 'merchant-1',
    product_id: 'product-1',
    stock_quantity: 10,
  },
  {
    attributes: { color: 'Graphite', ram: '8GB', storage: '256GB' },
    id: 'variant-256-8',
    merchant_id: 'merchant-1',
    product_id: 'product-1',
    stock_quantity: 8,
  },
];

describe('getRenderableCriticalVariantAxes', () => {
  it('keeps only axes with multiple visible options', () => {
    expect(
      getRenderableCriticalVariantAxes(['storage', 'ram', 'color'], variants)
    ).toEqual(['storage', 'ram']);
  });
});

describe('OgabasseyPdpCriticalVariantSelectors', () => {
  it('renders selectable variant axes and reports option clicks', () => {
    const onAttributeSelection = vi.fn();

    render(
      <OgabasseyPdpCriticalVariantSelectors
        onAttributeSelection={onAttributeSelection}
        renderableVariantAxes={['storage', 'ram']}
        selectedAttributes={{ ram: '4GB', storage: '128GB' }}
        variantCount={2}
        variants={variants}
      />
    );

    expect(
      screen.getByText('Choose options below before checkout.')
    ).toBeInTheDocument();
    expect(screen.getByText('Storage:')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /select 128gb storage/i })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: /select 256gb storage/i })
    ).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(
      screen.getByRole('button', { name: /select 256gb storage/i })
    );

    expect(onAttributeSelection).toHaveBeenCalledWith('storage', '256GB');
  });

  it('shows placeholder text when an axis is not selected', () => {
    render(
      <OgabasseyPdpCriticalVariantSelectors
        onAttributeSelection={vi.fn()}
        renderableVariantAxes={['storage', 'ram']}
        selectedAttributes={{}}
        variantCount={2}
        variants={variants}
      />
    );

    expect(screen.getByText('Select storage')).toBeInTheDocument();
    expect(screen.getByText('Select ram')).toBeInTheDocument();
  });

  it('renders multiple selected axes', () => {
    render(
      <OgabasseyPdpCriticalVariantSelectors
        onAttributeSelection={vi.fn()}
        renderableVariantAxes={['storage', 'ram']}
        selectedAttributes={{ ram: '8GB', storage: '256GB' }}
        variantCount={2}
        variants={variants}
      />
    );

    expect(screen.getByText('256GB', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('8GB', { selector: 'strong' })).toBeInTheDocument();
  });

  it('disables options that cannot produce a real SKU from explicit selections', () => {
    render(
      <OgabasseyPdpCriticalVariantSelectors
        explicitSelectedAxes={['storage']}
        onAttributeSelection={vi.fn()}
        renderableVariantAxes={['storage', 'ram']}
        selectedAttributes={{ storage: '256GB' }}
        variantCount={2}
        variants={variants}
      />
    );

    expect(
      screen.getByRole('button', { name: /select 4gb ram/i })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /select 8gb ram/i })
    ).toBeEnabled();
  });

  it('renders nothing when there are no variant options', () => {
    const { container } = render(
      <OgabasseyPdpCriticalVariantSelectors
        onAttributeSelection={vi.fn()}
        renderableVariantAxes={[]}
        selectedAttributes={{}}
        variantCount={2}
        variants={[]}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
