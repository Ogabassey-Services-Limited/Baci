import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('next/image', () => ({
  // biome-ignore lint/performance/noImgElement: test double
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt} />
  ),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => ({
    basePath: '/ogabassey',
  }),
}));

import { ProductComparisonTable } from './ProductComparisonTable';

function createMainProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'main-product',
    merchantId: 'merchant-1',
    name: 'Samsung Galaxy Z TriFold',
    slug: 'samsung-galaxy-z-trifold',
    price: '₦7,150,000',
    rawPrice: 7150000,
    image: 'https://example.com/main.jpg',
    images: ['https://example.com/main.jpg'],
    description: 'Flagship foldable',
    category: 'Smartphones',
    categorySlug: 'smartphones',
    condition: 'new',
    brand: 'Samsung',
    specs: [
      { label: 'Display', value: '10 inches' },
      { label: 'RAM', value: '16GB' },
      { label: 'Storage', value: '512GB' },
      { label: 'Battery', value: '5600mAh' },
    ],
    detailedSpecs: [
      {
        category: 'Display',
        items: [{ label: 'Size', value: '10 inches' }],
      },
      {
        category: 'Memory',
        items: [
          { label: 'RAM', value: '16GB' },
          { label: 'Internal Storage', value: '512GB' },
        ],
      },
      {
        category: 'Battery',
        items: [{ label: 'Capacity', value: '5600mAh' }],
      },
    ],
    ...overrides,
  };
}

describe('ProductComparisonTable', () => {
  it('renders the main product key specs summary rows from the product specs array', () => {
    render(
      <ProductComparisonTable
        mainProduct={createMainProduct()}
        storeSlug="ogabassey"
      />
    );

    const keySpecsRow = screen.getByText('Key Specs').closest('.grid');

    expect(keySpecsRow).not.toBeNull();

    const keySpecs = within(keySpecsRow as HTMLElement);
    expect(keySpecs.getByText('Display')).toBeInTheDocument();
    expect(keySpecs.getByText('10 inches')).toBeInTheDocument();
    expect(keySpecs.getByText('RAM')).toBeInTheDocument();
    expect(keySpecs.getByText('16GB')).toBeInTheDocument();
    expect(keySpecs.getByText('Storage')).toBeInTheDocument();
    expect(keySpecs.getByText('512GB')).toBeInTheDocument();
    expect(keySpecs.getByText('Battery')).toBeInTheDocument();
    expect(keySpecs.getByText('5600mAh')).toBeInTheDocument();
  });
});
