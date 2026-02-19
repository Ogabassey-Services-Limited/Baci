import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProductComparisonTable } from './ProductComparisonTable';
import React from 'react';

// Mock dependencies
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: () => ({
    basePath: '/test-store',
  }),
}));

// Mock next/image to inspect usage
vi.mock('next/image', () => ({
  default: (props: any) => {
    // We render a normal img but pass through all props so we can assert on them
    // We add data-testid to easily find it
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} data-testid="next-image" alt={props.alt} />;
  },
}));

const mockProduct: any = {
  id: '1',
  name: 'Main Product',
  price: '$100',
  rawPrice: 100,
  image: '/main.jpg',
  images: ['/main.jpg'],
  category: 'Phone',
  detailedSpecs: [],
  merchantId: 'm1',
  slug: 'main-product',
};

describe('ProductComparisonTable', () => {
  it('renders main product image using next/image optimization', () => {
    render(<ProductComparisonTable mainProduct={mockProduct} />);

    // Check if next/image was used for the main product image
    // Initially, the component uses raw <img> tags, so this query might return nothing (or just search result images if any, but none are rendered initially)
    // The component DOES use next/image for search results, but they are hidden initially.

    const images = screen.queryAllByTestId('next-image');

    // We expect the main product image to be rendered with next/image
    const mainImage = images.find(img => img.getAttribute('src') === '/main.jpg');

    // This assertion should FAIL before optimization
    expect(mainImage).toBeTruthy();
    expect(mainImage).toHaveAttribute('src', '/main.jpg');
    // Check for optimization props
    expect(mainImage).toHaveAttribute('sizes', '96px');
    // next/image 'fill' prop usually doesn't render as an attribute on the img tag directly in real DOM,
    // but in our mock we are spreading props, so 'fill' (boolean) might be passed if we don't destructure it.
    // However, usually 'fill' implies absolute positioning styles.
    // Let's check for the class 'object-contain' which is passed as className.
    expect(mainImage).toHaveClass('object-contain');
  });
});
