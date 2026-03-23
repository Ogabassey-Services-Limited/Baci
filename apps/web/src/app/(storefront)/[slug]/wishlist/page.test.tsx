import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./wishlist-content', () => ({
  WishListContent: () => <div data-testid="wishlist-content">Loaded</div>,
}));

// Import after mocks are set up
const { default: WishListPage } = await import('./page');

describe('WishListPage', () => {
  const params = Promise.resolve({ slug: 'test-store' });

  it('renders H1 in the initial synchronous output', () => {
    render(<WishListPage params={params} />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Your Wish List');
    expect(h1).toHaveClass('sr-only');
  });

  it('renders H1 alongside content when content resolves', () => {
    render(<WishListPage params={params} />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('wishlist-content')).toBeInTheDocument();
  });
});
