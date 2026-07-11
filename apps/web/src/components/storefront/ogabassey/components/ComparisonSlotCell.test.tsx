import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import type { ImgHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ComparisonSlotCell } from './ComparisonSlotCell';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/image', () => ({
  // biome-ignore lint/performance/noImgElement: test double
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt} />
  ),
}));

// Slot images now render through CdnFormatImage (explicit per-format <picture>);
// surface it as a plain <img> so these tests keep asserting slot behavior.
vi.mock('@/components/storefront/cdn-format-image', () => ({
  CdnFormatImage: (props: Record<string, unknown>) => {
    const { fill: _fill, preload: _preload, ...rest } = props;
    // biome-ignore lint/performance/noImgElement: test double
    return <img {...rest} alt={String(props.alt ?? '')} />;
  },
}));

describe('ComparisonSlotCell', () => {
  it('opens search from an empty comparison slot', () => {
    const onStartSearch = vi.fn();

    render(
      <ComparisonSlotCell
        slotIdx={1}
        isSearching={false}
        mainCategoryLabel="Smartphones"
        getProductHref={() => '/smartphones/iphone-17'}
        onRemoveProduct={vi.fn()}
        onStartSearch={onStartSearch}
        onCancelSearch={vi.fn()}
        query=""
        setQuery={vi.fn()}
        results={[]}
        loading={false}
        onSelectProduct={vi.fn()}
        searchInputRef={createRef<HTMLInputElement>()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /compare similar smartphones/i })
    );

    expect(onStartSearch).toHaveBeenCalledWith(1);
  });

  it('renders selected comparison product links and remove action', () => {
    const onRemoveProduct = vi.fn();

    render(
      <ComparisonSlotCell
        slotIdx={0}
        product={{
          id: 'iphone-17',
          name: 'iPhone 17',
          slug: 'iphone-17',
          price: '₦1,500,000',
          rawPrice: 1_500_000,
          image: '/iphone.png',
          images: ['/iphone.png'],
          description: '',
          condition: 'new',
        }}
        isSearching={false}
        getProductHref={() => '/smartphones/iphone-17'}
        onRemoveProduct={onRemoveProduct}
        onStartSearch={vi.fn()}
        onCancelSearch={vi.fn()}
        query=""
        setQuery={vi.fn()}
        results={[]}
        loading={false}
        onSelectProduct={vi.fn()}
        searchInputRef={createRef<HTMLInputElement>()}
      />
    );

    expect(screen.getByRole('link', { name: 'iPhone 17' })).toHaveAttribute(
      'href',
      '/smartphones/iphone-17'
    );

    fireEvent.click(screen.getByRole('button', { name: /remove product/i }));

    expect(onRemoveProduct).toHaveBeenCalledWith(0);
  });

  it('renders the search overlay when the slot is searching', () => {
    render(
      <ComparisonSlotCell
        slotIdx={1}
        isSearching={true}
        mainCategoryLabel="Smartphones"
        getProductHref={() => '/smartphones/iphone-17'}
        onRemoveProduct={vi.fn()}
        onStartSearch={vi.fn()}
        onCancelSearch={vi.fn()}
        query=""
        setQuery={vi.fn()}
        results={[]}
        loading={false}
        onSelectProduct={vi.fn()}
        searchInputRef={createRef<HTMLInputElement>()}
      />
    );

    expect(
      screen.getByRole('textbox', { name: /search products/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /cancel search in comparison slot 2/i,
      })
    ).toBeInTheDocument();
  });
});
