import { render, screen } from '@testing-library/react';
import * as ReactDOM from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
    expect(image).toHaveClass('storefront-shell-loading__mobile-hero-image', {
      exact: true,
    });

    const sources = container.querySelectorAll('source');
    expect(sources[0]).toHaveAttribute('srcset', '/hero-mobile.avif');
    expect(sources[0]).toHaveAttribute('type', 'image/avif');
    expect(sources[1]).toHaveAttribute('srcset', '/hero-mobile.jpg');
    expect(sources[1]).toHaveAttribute('type', 'image/jpeg');
  });

  it('preloads the mobile shell hero from the static fallback boundary', () => {
    const preloadSpy = vi.spyOn(ReactDOM, 'preload');

    render(
      <ShellChromeLoading
        mobileHeroImage={{
          alt: 'OgaBassey storefront hero',
          avifSrc: '/hero-mobile.avif',
          fallbackSrc: '/hero-mobile.jpg',
        }}
      />
    );

    expect(preloadSpy).toHaveBeenCalledWith('/hero-mobile.avif', {
      as: 'image',
      fetchPriority: 'high',
      media: '(max-width: 767px)',
      type: 'image/avif',
    });
  });

  it('does not preload a mobile hero when the shell has no hero image', () => {
    const preloadSpy = vi.spyOn(ReactDOM, 'preload');

    render(<ShellChromeLoading />);

    expect(preloadSpy).not.toHaveBeenCalled();
  });

  it('does not rely on external CSS for critical shell fallback geometry', () => {
    const { container } = render(
      <ShellChromeLoading
        mobileHeroImage={{
          alt: 'OgaBassey storefront hero',
          avifSrc: '/hero-mobile.avif',
          fallbackSrc: '/hero-mobile.jpg',
        }}
      />
    );

    const shell = container.querySelector('.storefront-shell-loading');
    const picture = container.querySelector(
      '.storefront-shell-loading__mobile-hero'
    );
    const image = screen.getByRole('img', {
      name: 'OgaBassey storefront hero',
    });
    const bar = container.querySelector('.storefront-shell-loading__bar');

    expect(shell).toHaveStyle({
      background: 'var(--store-background, #ffffff)',
      boxSizing: 'border-box',
      padding: '0.75rem 1rem',
    });
    expect(picture).toHaveStyle({
      aspectRatio: '16 / 9',
      overflow: 'hidden',
    });
    expect(image).toHaveStyle({
      height: 'auto',
      objectFit: 'contain',
    });
    expect(bar).toHaveStyle({
      height: '2.5rem',
    });
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
