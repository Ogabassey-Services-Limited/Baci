import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StorefrontRouteNotFoundContent } from './storefront-route-not-found-content';

describe('StorefrontRouteNotFoundContent', () => {
  it('renders the default storefront soft-not-found state', () => {
    render(<StorefrontRouteNotFoundContent />);

    expect(
      screen.getByRole('heading', { name: 'Page not found' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('The page you requested is unavailable or has moved.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Continue shopping' })
    ).toHaveAttribute('href', '/');
    expect(screen.getByRole('main')).toHaveAttribute(
      'data-storefront-soft-not-found',
      'true'
    );
  });

  it('renders stable soft-not-found content without throwing inside streamed route fallbacks', () => {
    render(
      <StorefrontRouteNotFoundContent
        backHref="/blog"
        backLabel="Back to blog"
        message="This article is unavailable or has moved."
        title="Blog post not found"
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Blog post not found' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('This article is unavailable or has moved.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to blog' })).toHaveAttribute(
      'href',
      '/blog'
    );
    expect(
      screen.getByRole('main').hasAttribute('data-storefront-soft-not-found')
    ).toBe(true);
  });
});
