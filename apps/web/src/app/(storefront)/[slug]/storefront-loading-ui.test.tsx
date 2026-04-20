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
    render(<ShellChromeLoading />);

    expect(
      screen.getByRole('status', { name: 'Loading storefront chrome' })
    ).toBeInTheDocument();
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
