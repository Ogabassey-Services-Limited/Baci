import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PreviewProductGrid } from './preview-product-grid';

describe('PreviewProductGrid', () => {
  it('renders a versioned, bounded local-asset fixture without network access', () => {
    const fetchSpy = vi.spyOn(window, 'fetch');
    render(<PreviewProductGrid columns={3} limit={24} title="Featured" />);

    const fixture = screen.getByTestId('builder-preview-products');
    const cards = screen.getAllByRole('article');
    expect(fixture).toHaveAttribute('data-fixture-version', 'v1');
    expect(cards).toHaveLength(3);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
