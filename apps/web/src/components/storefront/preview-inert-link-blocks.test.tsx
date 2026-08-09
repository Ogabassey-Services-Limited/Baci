import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { previewInertLinkBlocks } from './preview-inert-link-blocks';

describe('previewInertLinkBlocks', () => {
  it('renders all accepted link-bearing blocks without anchors or network activity', () => {
    const fetchSpy = vi.spyOn(window, 'fetch');
    render(
      <>
        {previewInertLinkBlocks.Hero.render({
          ctaText: 'Shop hero',
          subtitle: 'Preview copy',
          title: 'Hero',
        })}
        {previewInertLinkBlocks.HeroCarousel.render({
          slides: [{ ctaText: 'Shop carousel', title: 'Carousel' }],
        })}
        {previewInertLinkBlocks.Button.render({ text: 'Shop button' })}
        {previewInertLinkBlocks.Header.render({
          navigationLinks: [{ label: 'Shop' }],
          storeName: 'Preview Store',
        })}
        {previewInertLinkBlocks.Footer.render({
          quickLinks: [{ label: 'Contact' }],
          showQuickLinks: true,
        })}
      </>
    );

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Shop hero' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Shop carousel' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Shop button' })).toBeDisabled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('renders every bounded HeroCarousel slide so later slide edits stay visible and inert', () => {
    const fetchSpy = vi.spyOn(window, 'fetch');
    render(
      previewInertLinkBlocks.HeroCarousel.render({
        slides: [
          { ctaText: 'First action', title: 'First slide' },
          {
            ctaText: 'Edited second action',
            subtitle: 'Latest preview copy',
            title: 'Edited second slide',
          },
        ],
      })
    );

    expect(
      screen.getByRole('heading', { name: 'Edited second slide' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edited second action' })
    ).toBeDisabled();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('visibly reflects supported Header controls, layout, and sticky state with inert UI', () => {
    const { rerender } = render(
      previewInertLinkBlocks.Header.render({
        layout: 'logo-center',
        navigationLinks: [{ label: 'Shop' }],
        showCart: true,
        showMenu: true,
        showSearch: true,
        sticky: true,
        storeName: 'Preview Store',
      })
    );

    const header = screen.getByRole('banner');
    expect(header).toHaveAttribute('data-layout', 'logo-center');
    expect(header).toHaveAttribute('data-sticky', 'true');
    expect(header).toHaveClass('grid', 'sticky');
    expect(
      screen.getByRole('navigation', { name: 'Preview navigation' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cart' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Menu' })).toBeDisabled();

    rerender(
      previewInertLinkBlocks.Header.render({
        layout: 'logo-left-nav-right',
        showCart: false,
        showMenu: false,
        showSearch: false,
        sticky: false,
      })
    );

    expect(header).toHaveAttribute('data-layout', 'logo-left-nav-right');
    expect(header).toHaveAttribute('data-sticky', 'false');
    expect(header).toHaveClass('flex');
    expect(header).not.toHaveClass('sticky');
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cart' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
    expect(
      screen.queryByRole('navigation', { name: 'Preview navigation' })
    ).toBeNull();
  });

  it('applies accepted Footer colors and removes an empty navigation landmark', () => {
    const { rerender } = render(
      previewInertLinkBlocks.Footer.render({
        backgroundColor: '#123456',
        quickLinks: [{ label: 'Contact' }],
        showQuickLinks: true,
        textColor: '#ffffff',
      })
    );

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveStyle({
      backgroundColor: '#123456',
      color: '#ffffff',
    });
    expect(
      screen.getByRole('navigation', { name: 'Preview footer navigation' })
    ).toBeInTheDocument();

    rerender(
      previewInertLinkBlocks.Footer.render({
        backgroundColor: '#123456',
        quickLinks: [],
        showQuickLinks: true,
        textColor: '#ffffff',
      })
    );

    expect(
      screen.queryByRole('navigation', { name: 'Preview footer navigation' })
    ).toBeNull();
  });
});
