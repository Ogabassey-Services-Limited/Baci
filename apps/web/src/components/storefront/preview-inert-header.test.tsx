import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PreviewInertHeader } from './preview-inert-header';

describe('PreviewInertHeader', () => {
  it('visibly reflects supported controls, layout, and sticky state with inert UI', () => {
    const { rerender } = render(
      <PreviewInertHeader
        layout="logo-center"
        navigationLinks={[{ label: 'Shop' }]}
        showCart
        showMenu
        showSearch
        sticky
        storeName="Preview Store"
      />
    );

    const header = screen.getByRole('banner');
    expect(header).toHaveAttribute('data-layout', 'logo-center');
    expect(header).toHaveAttribute('data-sticky', 'true');
    expect(header).toHaveClass('grid', 'sticky');
    expect(
      screen.getByRole('navigation', { name: 'Preview navigation' })
    ).toHaveClass('hidden', 'md:flex');
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Account' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cart' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Menu' })).toBeDisabled();

    rerender(
      <PreviewInertHeader layout="logo-left-nav-right" showAccount={false} />
    );

    expect(header).toHaveAttribute('data-layout', 'logo-left-nav-right');
    expect(header).toHaveAttribute('data-sticky', 'false');
    expect(header).toHaveClass('flex');
    expect(header).not.toHaveClass('sticky');
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Account' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cart' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
  });

  it('hides saved navigation links when the production menu control is disabled', () => {
    render(
      <PreviewInertHeader
        navigationLinks={[{ label: 'Shop' }]}
        showMenu={false}
      />
    );

    expect(
      screen.queryByRole('navigation', { name: 'Preview navigation' })
    ).toBeNull();
  });

  it('renders every supported search style, radius, glass, and padding control', () => {
    render(
      <PreviewInertHeader
        glassEffect
        paddingY="lg"
        searchRadius="full"
        searchStyle="filled"
        showSearch
      />
    );

    const header = screen.getByRole('banner');
    const search = screen.getByRole('button', { name: 'Search' });
    expect(header).toHaveAttribute('data-glass-effect', 'true');
    expect(header).toHaveClass('backdrop-blur-md', 'py-6');
    expect(search).toHaveAttribute('data-search-style', 'filled');
    expect(search).toHaveAttribute('data-search-radius', 'full');
    expect(search).toHaveClass('bg-muted', 'rounded-full');
    expect(search).toBeDisabled();
  });

  it('applies persisted storefront header colors', () => {
    render(
      <PreviewInertHeader backgroundColor="#123456" textColor="#fefefe" />
    );

    expect(screen.getByRole('banner')).toHaveStyle({
      backgroundColor: '#123456',
      color: '#fefefe',
    });
  });

  it('renders a retained local background image as an inert pattern', () => {
    render(<PreviewInertHeader backgroundImage="/media/header.webp" />);

    expect(screen.getByTestId('builder-preview-header-background')).toHaveStyle(
      { backgroundImage: 'url(/media/header.webp)' }
    );
  });

  it('renders a retained local logo when logos are enabled', () => {
    render(
      <PreviewInertHeader logoUrl="/media/logo.png" storeName="Acme Store" />
    );

    expect(
      screen.getByRole('img', { name: 'Acme Store logo' })
    ).toHaveAttribute('src', '/media/logo.png');
  });
});
