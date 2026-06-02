import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BlogListingRouteLoading,
  BlogPostRouteLoading,
  CatalogListingLoading,
  CommerceRouteLoading,
  ContentRouteLoading,
  CustomerRouteLoading,
  HomeRouteLoading,
  ProductDetailRouteLoading,
  ShellChromeLoading,
  UtilityRouteLoading,
} from './storefront-loading-ui';

describe('storefront-loading-ui', () => {
  it('renders the shell chrome loading fallback', () => {
    const { container } = render(<ShellChromeLoading />);

    expect(
      screen.getByRole('status', { name: 'Loading storefront chrome' })
    ).toBeInTheDocument();
    expect(
      container.querySelector('.storefront-shell-loading')
    ).toBeInTheDocument();
    expect(
      container.querySelector('.storefront-shell-loading__bar')
    ).toBeInTheDocument();
  });

  it('can preserve the mobile LCP hero image in the shell fallback', () => {
    const { container } = render(
      <ShellChromeLoading
        mobileHeroImage={{
          alt: 'OgaBassey storefront hero',
          avifSrc: '/hero-mobile.avif',
          fallbackSrc: '/hero-mobile.jpg',
        }}
      />
    );

    const image = screen.getByRole('img', {
      name: 'OgaBassey storefront hero',
    });
    expect(image).toHaveAttribute('fetchpriority', 'high');
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('decoding', 'sync');
    expect(image).toHaveAttribute('width', '960');
    expect(image).toHaveAttribute('height', '540');
    expect(image).toHaveClass('h-full', 'w-full', 'object-contain');

    const sources = container.querySelectorAll('source');
    expect(sources[0]).toHaveAttribute('srcset', '/hero-mobile.avif');
    expect(sources[0]).toHaveAttribute('type', 'image/avif');
    expect(sources[1]).toHaveAttribute('srcset', '/hero-mobile.jpg');
    expect(sources[1]).toHaveAttribute('type', 'image/jpeg');
  });

  it('renders the shared route loading primitives', () => {
    render(
      <>
        <HomeRouteLoading />
        <CatalogListingLoading />
        <ProductDetailRouteLoading />
        <BlogListingRouteLoading />
        <BlogPostRouteLoading />
        <ContentRouteLoading />
        <CommerceRouteLoading />
        <CustomerRouteLoading />
        <UtilityRouteLoading />
      </>
    );

    expect(
      screen.getByRole('status', { name: 'Loading storefront homepage' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading product listing' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading product page' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading blog posts' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading blog post' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading page content' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading commerce page' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading customer page' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading utility page' })
    ).toBeInTheDocument();
  });
});
