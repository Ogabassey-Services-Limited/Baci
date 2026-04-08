import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { NormalizedProductDetails } from './product-details-helpers';
import { ProductOptionSelectors } from './product-option-selectors';

function buildProductData(
  overrides: Partial<NormalizedProductDetails> = {},
): NormalizedProductDetails {
  return {
    id: 'prod-1',
    name: 'Test Product',
    slug: 'test-product',
    price: '₦500,000',
    rawPrice: 500000,
    image: 'https://example.com/img.jpg',
    images: ['https://example.com/img.jpg'],
    description: 'A smartphone.',
    brand: 'Samsung',
    condition: 'open_box',
    rating: 0,
    reviewCount: 0,
    specs: [],
    detailedSpecs: [],
    colors: [],
    colorImages: {},
    storage: [],
    platforms: [],
    displaySize: '',
    ram: '',
    ...overrides,
  };
}

const s22Variants = [
  { id: 'v1', attributes: { ram: '8GB', storage: '128GB' }, price_override: 500000, stock_quantity: 9999 },
  { id: 'v2', attributes: { ram: '12GB', storage: '256GB' }, price_override: 550000, stock_quantity: 9999 },
  { id: 'v3', attributes: { ram: '12GB', storage: '512GB' }, price_override: 600000, stock_quantity: 9999 },
];

function renderSelectors({
  selectedAttributes = {},
  effectiveAxes = ['storage', 'ram'],
  variants = s22Variants,
  onSelectAttribute = vi.fn() as (axis: string, value: string) => void,
}: {
  selectedAttributes?: Record<string, string>;
  effectiveAxes?: string[];
  variants?: typeof s22Variants;
  onSelectAttribute?: (axis: string, value: string) => void;
} = {}) {
  const productData = buildProductData({ variants });

  render(
    <ProductOptionSelectors
      deliveryEstimate="1–2 days"
      deliveryLocation="Lagos"
      descriptionExcerpt="Great phone."
      effectiveAxes={effectiveAxes}
      formatAxisLabel={(axis) => axis.toUpperCase()}
      getAxisOptions={(axis) => {
        const all = variants.flatMap((v) => {
          const val = v.attributes[axis as keyof typeof v.attributes];
          return val ? [val] : [];
        });
        return [...new Set(all)];
      }}
      onChangeDeliveryLocation={vi.fn()}
      onSelectAttribute={onSelectAttribute}
      onSelectColor={vi.fn()}
      onSelectSecondaryColor={vi.fn()}
      productData={productData}
      secondaryColor={null}
      selectedAttributes={selectedAttributes}
      selectedColor={null}
      showColorToast={false}
    />,
  );

  return { onSelectAttribute };
}

describe('ProductOptionSelectors — dependent variant filtering', () => {
  it('renders all storage options as enabled when no RAM is selected', () => {
    renderSelectors({ effectiveAxes: ['storage'] });

    expect(
      screen.getByRole('button', { name: /128GB/i }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole('button', { name: /256GB/i }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole('button', { name: /512GB/i }),
    ).not.toBeDisabled();
  });

  it('disables storage options that have no variant matching the selected RAM', async () => {
    renderSelectors({
      selectedAttributes: { ram: '8GB' },
      effectiveAxes: ['storage'],
    });

    const btn128 = screen.getByRole('button', { name: /128GB/i });
    const btn256 = screen.getByRole('button', { name: /256GB/i });
    const btn512 = screen.getByRole('button', { name: /512GB/i });

    expect(btn128).not.toBeDisabled();
    expect(btn256).toBeDisabled();
    expect(btn512).toBeDisabled();
  });

  it('enables multiple storage options when a RAM with multiple pairs is selected', () => {
    renderSelectors({
      selectedAttributes: { ram: '12GB' },
      effectiveAxes: ['storage'],
    });

    expect(
      screen.getByRole('button', { name: /128GB/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /256GB/i }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole('button', { name: /512GB/i }),
    ).not.toBeDisabled();
  });

  it('calls onSelectAttribute when an available option is clicked', async () => {
    const user = userEvent.setup();
    const onSelectAttribute = vi.fn();

    renderSelectors({
      selectedAttributes: { ram: '8GB' },
      effectiveAxes: ['storage'],
      onSelectAttribute,
    });

    await user.click(screen.getByRole('button', { name: /128GB/i }));
    expect(onSelectAttribute).toHaveBeenCalledWith('storage', '128GB');
  });

  it('does not call onSelectAttribute when a disabled option is clicked', async () => {
    const user = userEvent.setup();
    const onSelectAttribute = vi.fn();

    renderSelectors({
      selectedAttributes: { ram: '8GB' },
      effectiveAxes: ['storage'],
      onSelectAttribute,
    });

    await user.click(screen.getByRole('button', { name: /256GB/i }));
    expect(onSelectAttribute).not.toHaveBeenCalled();
  });

  it('marks unavailable options with aria-disabled and line-through styling', () => {
    renderSelectors({
      selectedAttributes: { ram: '8GB' },
      effectiveAxes: ['storage'],
    });

    const disabled256 = screen.getByRole('button', { name: /256GB/i });
    expect(disabled256).toHaveAttribute('aria-disabled', 'true');
    expect(disabled256.className).toMatch(/line-through/);
  });
});
