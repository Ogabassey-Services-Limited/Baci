import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PreviewProductGrid } from './preview-product-grid';

describe('PreviewProductGrid', () => {
  it('visibly applies candidate limit and showFilters controls without network access', () => {
    const fetchSpy = vi.spyOn(window, 'fetch');
    const { rerender } = render(
      <PreviewProductGrid
        columns={3}
        limit={2}
        showFilters={false}
        title="Featured"
      />
    );

    const fixture = screen.getByTestId('builder-preview-products');
    expect(fixture).toHaveAttribute('data-fixture-version', 'v2');
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('Sample price 1')).toBeInTheDocument();
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('builder-preview-product-filters')
    ).not.toBeInTheDocument();

    rerender(
      <PreviewProductGrid columns={3} limit={24} showFilters title="Featured" />
    );

    expect(screen.getAllByRole('article')).toHaveLength(24);
    expect(
      screen.getByTestId('builder-preview-product-filters')
    ).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
