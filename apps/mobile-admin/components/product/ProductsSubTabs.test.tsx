import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductsSubTabs } from './ProductsSubTabs';

const counts = {
  categories: 2,
  items: 5,
  lowStock: 3,
  outOfStock: 1,
};

describe('ProductsSubTabs', () => {
  it('renders all five tabs with counts for the in_stock variant', () => {
    render(
      <ProductsSubTabs
        activeTab="in_stock"
        counts={counts}
        onSelect={vi.fn()}
        variant="in_stock"
      />
    );

    expect(
      screen.getByRole('tab', { name: 'Items (5), currently selected' })
    ).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Categories (2)' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Low Stock (3)' })).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: 'Out of Stock (1)' })
    ).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Top Selling' })).toBeTruthy();
  });

  it('keeps the product sub-tab rail constrained to chip height', () => {
    render(
      <ProductsSubTabs
        activeTab="in_stock"
        counts={counts}
        onSelect={vi.fn()}
        variant="in_stock"
      />
    );

    expect(screen.getByRole('tablist')).toHaveStyle({
      flexGrow: '0',
      maxHeight: '40px',
    });
  });

  it('renders only three tabs for the on_website variant, omitting stock tabs', () => {
    render(
      <ProductsSubTabs
        activeTab="all"
        counts={counts}
        onSelect={vi.fn()}
        variant="on_website"
      />
    );

    expect(
      screen.getByRole('tab', { name: 'Items (5), currently selected' })
    ).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Categories (2)' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Top Selling' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /Low Stock/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Out of Stock/ })).toBeNull();
  });

  it('calls onSelect with the tab id when a tab is pressed', () => {
    const onSelect = vi.fn();

    render(
      <ProductsSubTabs
        activeTab="in_stock"
        counts={counts}
        onSelect={onSelect}
        variant="in_stock"
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Low Stock (3)' }));

    expect(onSelect).toHaveBeenCalledWith('low_stock');
  });

  it('selects the "all" items tab id for the on_website variant', () => {
    const onSelect = vi.fn();

    render(
      <ProductsSubTabs
        activeTab="categories"
        counts={counts}
        onSelect={onSelect}
        variant="on_website"
      />
    );

    fireEvent.click(
      screen.getByRole('tab', { name: 'Items (5)' })
    );

    expect(onSelect).toHaveBeenCalledWith('all');
  });

  it('marks only the active tab as currently selected', () => {
    render(
      <ProductsSubTabs
        activeTab="out_of_stock"
        counts={counts}
        onSelect={vi.fn()}
        variant="in_stock"
      />
    );

    expect(
      screen.getByRole('tab', {
        name: 'Out of Stock (1), currently selected',
      })
    ).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /Items.*selected/ })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Items (5)' })).toBeTruthy();
  });
});
