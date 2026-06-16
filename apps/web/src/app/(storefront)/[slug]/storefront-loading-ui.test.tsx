import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
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
    expect(image).toHaveClass('storefront-shell-loading__mobile-hero-image', {
      exact: true,
    });

    const sources = container.querySelectorAll('source');
    expect(sources[0]).toHaveAttribute('srcset', '/hero-mobile.avif');
    expect(sources[0]).toHaveAttribute('type', 'image/avif');
    expect(sources[1]).toHaveAttribute('srcset', '/hero-mobile.jpg');
    expect(sources[1]).toHaveAttribute('type', 'image/jpeg');
  });

  it('can render a lightweight storefront chrome frame before the mobile hero', () => {
    const { container } = render(
      <ShellChromeLoading
        showChromeFrame
        mobileHeroImage={{
          alt: 'OgaBassey storefront hero',
          avifSrc: '/hero-mobile.avif',
          fallbackSrc: '/hero-mobile.jpg',
        }}
      />
    );

    const chromeFrame = container.querySelector(
      '.storefront-shell-loading__chrome'
    );
    const hero = container.querySelector(
      '.storefront-shell-loading__mobile-hero'
    );

    expect(chromeFrame).toBeInTheDocument();
    expect(chromeFrame).toHaveAttribute('aria-hidden', 'true');
    expect(hero).toBeInTheDocument();
    expect(hero?.previousElementSibling).toBe(chromeFrame);
  });

  it('does not render the storefront chrome frame by default', () => {
    const { container } = render(
      <ShellChromeLoading
        mobileHeroImage={{
          alt: 'OgaBassey storefront hero',
          avifSrc: '/hero-mobile.avif',
          fallbackSrc: '/hero-mobile.jpg',
        }}
      />
    );

    expect(
      container.querySelector('.storefront-shell-loading__chrome')
    ).not.toBeInTheDocument();
  });

  it('emits a viewport-scoped preload link for the mobile shell hero', () => {
    const html = renderToString(
      <ShellChromeLoading
        mobileHeroImage={{
          alt: 'OgaBassey storefront hero',
          avifSrc: '/hero-mobile.avif',
          fallbackSrc: '/hero-mobile.jpg',
        }}
      />
    );
    const template = document.createElement('template');
    template.innerHTML = html;
    const preload = template.content.querySelector(
      'link[rel="preload"][href="/hero-mobile.avif"]'
    );

    expect(preload).toBeTruthy();
    expect(preload?.getAttribute('as')).toBe('image');
    expect(preload?.getAttribute('fetchpriority')).toBe('high');
    expect(preload?.getAttribute('media')).toBe('(max-width: 767px)');
    expect(preload?.getAttribute('type')).toBe('image/avif');
  });

  it('uses an inline shell hero source without preloading an external mobile AVIF', () => {
    const html = renderToString(
      <ShellChromeLoading
        mobileHeroImage={{
          alt: 'OgaBassey storefront hero',
          avifSrc: '/hero-mobile.avif',
          fallbackSrc: '/hero-mobile.jpg',
          inlineAvifSrc: 'data:image/avif;base64,AAAA',
        }}
      />
    );
    const template = document.createElement('template');
    template.innerHTML = html;

    expect(
      template.content.querySelector(
        'link[rel="preload"][href="/hero-mobile.avif"]'
      )
    ).toBeNull();
    const inlineSource = template.content.querySelector(
      'source[type="image/avif"]'
    );

    expect(inlineSource?.getAttribute('srcset')).toBe(
      'data:image/avif;base64,AAAA'
    );
  });

  it('does not emit a preload link when the shell has no hero image', () => {
    const html = renderToString(<ShellChromeLoading />);
    const template = document.createElement('template');
    template.innerHTML = html;

    expect(template.content.querySelector('link[rel="preload"]')).toBeNull();
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
