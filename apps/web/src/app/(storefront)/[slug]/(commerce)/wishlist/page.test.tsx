import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
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

  it('does not render a wrapper H1 in the initial synchronous output', () => {
    suspended = true;

    render(
      <Suspense fallback={null}>
        <WishListPage params={Promise.resolve({ slug: 'test-store' })} />
      </Suspense>
    );

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('does not render a page-owned loading fallback while content is loading', () => {
    suspended = true;

    render(
      <Suspense fallback={null}>
        <WishListPage params={Promise.resolve({ slug: 'test-store' })} />
      </Suspense>
    );

    expect(screen.queryByText('Loading wish list...')).toBeNull();
  });

  it('renders content when data resolves', () => {
    suspended = false;

    render(
      <Suspense fallback={null}>
        <WishListPage params={Promise.resolve({ slug: 'test-store' })} />
      </Suspense>
    );

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByTestId('wishlist-content')).toBeInTheDocument();
  });
});
