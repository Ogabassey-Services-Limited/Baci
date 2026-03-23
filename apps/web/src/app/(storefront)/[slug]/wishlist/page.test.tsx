import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let suspended = false;

vi.mock('./wishlist-content', () => ({
  WishListContent: () => {
    if (suspended) {
      // Throw a pending Promise to trigger Suspense fallback (React protocol)
      throw new Promise<void>(() => {
        /* deferred: keep Suspense pending */
      });
    }
    return <div data-testid="wishlist-content">Loaded</div>;
  },
}));

const { default: WishListPage } = await import('./page');

describe('WishListPage', () => {
  beforeEach(() => {
    suspended = false;
  });

  it('renders H1 in the initial synchronous output', () => {
    suspended = true;

    render(<WishListPage params={Promise.resolve({ slug: 'test-store' })} />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Your Wish List');
    expect(h1).toHaveClass('sr-only');
  });

  it('renders Suspense fallback while content is loading', () => {
    suspended = true;

    render(<WishListPage params={Promise.resolve({ slug: 'test-store' })} />);

    expect(screen.getByText('Loading wish list...')).toBeInTheDocument();
  });

  it('renders content when data resolves', () => {
    suspended = false;

    render(<WishListPage params={Promise.resolve({ slug: 'test-store' })} />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('wishlist-content')).toBeInTheDocument();
  });
});
