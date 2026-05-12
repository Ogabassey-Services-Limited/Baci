import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { VariantBuilder } from '@/components/products/variant-builder';

type NextImageMockProps = {
  alt?: string;
  className?: string;
  fill?: boolean;
  height?: number | string;
  priority?: boolean;
  src: string | { src: string };
  width?: number | string;
};

vi.mock('next/image', () => ({
  default: ({
    alt = '',
    className,
    fill: _fill,
    height,
    priority: _priority,
    src,
    width,
  }: NextImageMockProps) => (
    <span
      aria-label={alt}
      className={className}
      data-height={height}
      data-src={typeof src === 'string' ? src : src.src}
      data-width={width}
      role="img"
    />
  ),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: vi.fn(() => ({
    merchant: { country: 'NG' },
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

function VariantBuilderWithForm({
  stockTrackingEnabled = false,
}: {
  stockTrackingEnabled?: boolean;
}) {
  const form = useForm();

  return (
    <FormProvider {...form}>
      <VariantBuilder
        basePrice={437000}
        categoryConfig={{
          description: 'Phones and accessories',
          displayName: 'Electronics',
          supportsVariants: true,
        }}
        initialVariants={[
          {
            id: 'variant-128gb',
            attributes: { storage: '128GB' },
            merchant_id: 'm-1',
            price_override: 437000,
            product_id: 'prod-iphone-13',
            stock_quantity: 0,
          },
        ]}
        onVariantsChange={vi.fn()}
        stockTrackingEnabled={stockTrackingEnabled}
      />
    </FormProvider>
  );
}

describe('VariantBuilder', () => {
  it('exports a valid component', () => {
    expect(VariantBuilder).toBeDefined();
    expect(typeof VariantBuilder).toBe('function');
  });

  it('hides variant stock controls when product unlimited stock is enabled', () => {
    render(<VariantBuilderWithForm stockTrackingEnabled={false} />);

    expect(
      screen.getByText(
        'Unlimited stock is enabled for this product. Variant stock quantities are not required.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('Track Inventory')).not.toBeInTheDocument();
    expect(
      screen.queryByText('3. Set stock quantity per variant')
    ).not.toBeInTheDocument();
  });

  it('shows variant stock controls when product stock tracking is enabled', () => {
    render(<VariantBuilderWithForm stockTrackingEnabled={true} />);

    expect(screen.getByText('Track Inventory')).toBeInTheDocument();
    expect(
      screen.getByText('Manage stock levels for each variant.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('3. Set stock quantity per variant')
    ).toBeInTheDocument();
  });
});
