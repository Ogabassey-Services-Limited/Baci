import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StorefrontLayoutFallback } from './storefront-layout-fallback';

describe('StorefrontLayoutFallback', () => {
  it('renders a home-shaped fallback for storefront home routes', () => {
    render(<StorefrontLayoutFallback pathname="/ogabassey" slug="ogabassey" />);

    expect(
      screen.getByRole('status', { name: 'Loading storefront homepage' })
    ).toBeInTheDocument();
  });

  it('renders the blog listing fallback for blog index routes', () => {
    render(
      <StorefrontLayoutFallback pathname="/ogabassey/blog" slug="ogabassey" />
    );

    expect(
      screen.getByRole('status', { name: 'Loading blog posts' })
    ).toBeInTheDocument();
  });

  it('renders the product detail fallback for product routes', () => {
    render(
      <StorefrontLayoutFallback
        pathname="/ogabassey/smartphones/samsung-galaxy-z-trifold"
        slug="ogabassey"
      />
    );

    expect(
      screen.getByRole('status', { name: 'Loading product page' })
    ).toBeInTheDocument();
  });

  it('keeps a neutral generic shell for non-catalog informational routes', () => {
    const { container } = render(
      <StorefrontLayoutFallback pathname="/ogabassey/about" slug="ogabassey" />
    );

    const shell = container.querySelector('.min-h-screen');

    expect(
      screen.getByRole('status', { name: 'Loading store' })
    ).toBeInTheDocument();
    expect(shell).not.toBeNull();
    expect(shell as HTMLElement).toHaveClass('min-h-screen', 'bg-[#fafafa]');
  });
});
