import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedProductDetails } from './product-details-helpers';
import { ProductMediaGallery } from './product-media-gallery';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img
      {...Object.fromEntries(
        Object.entries(props).filter(
          ([key]) => key !== 'fill' && key !== 'priority'
        )
      )}
      alt={String(props.alt ?? '')}
    />
  ),
}));

function buildProductData(
  overrides: Partial<NormalizedProductDetails> = {},
): NormalizedProductDetails {
  return {
    id: 'prod-1',
    name: 'Test Product',
    slug: 'test-product',
    price: '₦500,000',
    rawPrice: 500000,
    image: 'https://example.com/img-1.jpg',
    images: [
      'https://example.com/img-1.jpg',
      'https://example.com/img-2.jpg',
      'https://example.com/img-3.jpg',
    ],
    description: 'A smartphone.',
    brand: 'Samsung',
    condition: 'new',
    rating: 4.5,
    reviewCount: 12,
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

describe('ProductMediaGallery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders the main product image immediately while deferring thumbnail buttons', async () => {
    render(
      <ProductMediaGallery
        onSelectImage={vi.fn()}
        productData={buildProductData()}
        selectedCondition="new"
        selectedImage={0}
      />,
    );

    expect(screen.getByAltText('Test Product')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'View image 2' }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(
      screen.getByRole('button', { name: 'View image 2' }),
    ).toBeInTheDocument();
  });

  it('activates thumbnail controls on interaction and forwards image selection', async () => {
    const onSelectImage = vi.fn();

    render(
      <ProductMediaGallery
        onSelectImage={onSelectImage}
        productData={buildProductData()}
        selectedCondition="new"
        selectedImage={0}
      />,
    );

    await act(async () => {
      fireEvent.scroll(window);
    });

    fireEvent.click(screen.getByRole('button', { name: 'View image 3' }));

    expect(onSelectImage).toHaveBeenCalledWith(2);
  });
});
