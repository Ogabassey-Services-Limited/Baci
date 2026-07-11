import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ComparisonSlotSearchOverlay } from './ComparisonSlotSearchOverlay';

vi.mock('next/image', () => ({
  // biome-ignore lint/performance/noImgElement: test double
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt} />
  ),
}));

// Result thumbnails now render through CdnFormatImage (explicit per-format
// <picture>); surface it as a plain <img> so these tests keep asserting overlay
// behavior.
vi.mock('@/components/storefront/cdn-format-image', () => ({
  CdnFormatImage: (props: Record<string, unknown>) => {
    const { fill: _fill, preload: _preload, ...rest } = props;
    // biome-ignore lint/performance/noImgElement: test double
    return <img {...rest} alt={String(props.alt ?? '')} />;
  },
}));

describe('ComparisonSlotSearchOverlay', () => {
  it('renders search results and forwards cancel, query, and selection events', () => {
    const onCancel = vi.fn();
    const setQuery = vi.fn();
    const onSelectProduct = vi.fn();

    render(
      <ComparisonSlotSearchOverlay
        slotIdx={0}
        isSearching={true}
        onCancel={onCancel}
        query="iphone"
        setQuery={setQuery}
        results={[
          {
            id: 'iphone-17',
            name: 'iPhone 17',
            price: 1_500_000,
            image: '/iphone.png',
          },
        ]}
        loading={false}
        onSelectProduct={onSelectProduct}
        searchInputRef={createRef<HTMLInputElement>()}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: /search products/i }), {
      target: { value: 'galaxy' },
    });
    fireEvent.click(screen.getByRole('button', { name: /iphone 17/i }));
    fireEvent.click(
      screen.getByRole('button', {
        name: /cancel search in comparison slot 1/i,
      })
    );

    expect(setQuery).toHaveBeenCalledWith('galaxy');
    expect(onSelectProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'iphone-17' })
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses configurable locale and currency when formatting result prices', () => {
    render(
      <ComparisonSlotSearchOverlay
        slotIdx={0}
        isSearching={true}
        onCancel={vi.fn()}
        query="iphone"
        setQuery={vi.fn()}
        results={[
          {
            id: 'iphone-17',
            name: 'iPhone 17',
            price: 1500,
            image: '/iphone.png',
          },
        ]}
        loading={false}
        onSelectProduct={vi.fn()}
        searchInputRef={createRef<HTMLInputElement>()}
        locale="en-US"
        currencyCode="USD"
      />
    );

    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
  });

  it('renders an accessible loading state', () => {
    render(
      <ComparisonSlotSearchOverlay
        slotIdx={0}
        isSearching={true}
        onCancel={vi.fn()}
        query="iphone"
        setQuery={vi.fn()}
        results={[]}
        loading={true}
        onSelectProduct={vi.fn()}
        searchInputRef={createRef<HTMLInputElement>()}
      />
    );

    expect(
      screen.getByRole('status', { name: /loading products/i })
    ).toBeInTheDocument();
  });

  it('renders an empty-results message after a query returns no products', () => {
    render(
      <ComparisonSlotSearchOverlay
        slotIdx={0}
        isSearching={true}
        onCancel={vi.fn()}
        query="xyz"
        setQuery={vi.fn()}
        results={[]}
        loading={false}
        onSelectProduct={vi.fn()}
        searchInputRef={createRef<HTMLInputElement>()}
      />
    );

    expect(screen.getByText(/no products found/i)).toBeInTheDocument();
  });

  it('renders search errors instead of the empty-results message', () => {
    render(
      <ComparisonSlotSearchOverlay
        slotIdx={0}
        isSearching={true}
        onCancel={vi.fn()}
        query="xyz"
        setQuery={vi.fn()}
        results={[]}
        loading={false}
        searchError="Could not load products. Try again."
        onSelectProduct={vi.fn()}
        searchInputRef={createRef<HTMLInputElement>()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      /could not load products/i
    );
    expect(screen.queryByText(/no products found/i)).not.toBeInTheDocument();
  });

  it('does not render when the slot is not searching', () => {
    const { container } = render(
      <ComparisonSlotSearchOverlay
        slotIdx={0}
        isSearching={false}
        onCancel={vi.fn()}
        query=""
        setQuery={vi.fn()}
        results={[]}
        loading={false}
        onSelectProduct={vi.fn()}
        searchInputRef={createRef<HTMLInputElement>()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
