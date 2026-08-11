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

  it('preserves bounded Hero heading, alignment, and padding in the preview', () => {
    render(
      previewInertLinkBlocks.Hero.render({
        align: 'right',
        headingLevel: 'h2',
        padding: 'large',
        title: 'Catalog preview',
      })
    );

    const hero = screen.getByRole('heading', { level: 2 });
    expect(hero).toHaveTextContent('Catalog preview');
    expect(hero.parentElement).toHaveClass('text-right', 'py-16');
  });

  it('shows bounded FAQ answers without relying on interactive accordion state', () => {
    render(
      previewInertLinkBlocks.FAQ.render({
        items: [{ answer: 'Ships in 3 days.', question: 'When does it ship?' }],
        title: 'Questions',
      })
    );

    expect(screen.getByText('When does it ship?')).toBeInTheDocument();
    expect(screen.getByText('Ships in 3 days.')).toBeInTheDocument();
  });

  it('reflects Header padding, Hero media/overlay, and FAQ style changes', () => {
    render(
      <>
        {previewInertLinkBlocks.Header.render({ paddingY: 'lg' })}
        {previewInertLinkBlocks.Hero.render({
          backgroundImage: '/hero.webp',
          overlay: true,
          title: 'Hero',
        })}
        {previewInertLinkBlocks.FAQ.render({
          items: [{ answer: 'Answer', question: 'Question' }],
          style: 'grid',
        })}
      </>
    );
    expect(screen.getByTestId('builder-preview-inert-header')).toHaveClass(
      'py-6'
    );
    expect(screen.getByRole('region', { name: 'Preview hero' })).toHaveClass(
      'bg-store-background-text/40',
      'text-store-background'
    );
    expect(screen.getByRole('region', { name: 'Preview hero' })).toHaveStyle({
      backgroundImage: 'url(/hero.webp)',
    });
    expect(
      screen
        .getByRole('region', { name: 'Preview FAQ' })
        .querySelector('[data-style]')
    ).toHaveAttribute('data-style', 'grid');
  });

  it('does not apply a Hero overlay without a background image', () => {
    render(
      previewInertLinkBlocks.Hero.render({ overlay: true, title: 'Plain hero' })
    );

    expect(
      screen.getByRole('region', { name: 'Preview hero' })
    ).not.toHaveClass('bg-store-background-text/40', 'text-store-background');
  });

  it('renders refused saved sections as bounded inert placeholders', () => {
    render(
      previewInertLinkBlocks.PreviewPlaceholder.render({
        label: 'CodeEmbed section',
      })
    );

    expect(
      screen.getByRole('region', {
        name: 'CodeEmbed section preview placeholder',
      })
    ).toHaveTextContent('CodeEmbed section');
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

  it('visibly applies every supported Button align, size, and variant while staying inert', () => {
    const { rerender } = render(
      previewInertLinkBlocks.Button.render({
        align: 'right',
        size: 'lg',
        text: 'Large accent action',
        variant: 'accent',
      })
    );

    const surface = screen.getByTestId('builder-preview-inert-button');
    const button = screen.getByRole('button', {
      name: 'Large accent action',
    });
    expect(surface).toHaveAttribute('data-align', 'right');
    expect(surface).toHaveAttribute('data-size', 'lg');
    expect(surface).toHaveAttribute('data-variant', 'accent');
    expect(surface).toHaveClass('justify-end');
    expect(button).toHaveClass(
      'bg-store-accent',
      'h-10',
      'px-6',
      'text-store-accent-text'
    );
    expect(button).toBeDisabled();

    rerender(
      previewInertLinkBlocks.Button.render({
        align: 'left',
        size: 'sm',
        text: 'Small background action',
        variant: 'background',
      })
    );

    expect(surface).toHaveAttribute('data-align', 'left');
    expect(surface).toHaveAttribute('data-size', 'sm');
    expect(surface).toHaveAttribute('data-variant', 'background');
    expect(surface).toHaveClass('justify-start');
    expect(
      screen.getByRole('button', { name: 'Small background action' })
    ).toHaveClass(
      'bg-store-background',
      'h-8',
      'px-3',
      'text-store-background-text'
    );

    rerender(
      previewInertLinkBlocks.Button.render({
        align: 'center',
        size: 'default',
        text: 'Default primary action',
        variant: 'primary',
      })
    );

    expect(surface).toHaveClass('justify-center');
    expect(
      screen.getByRole('button', { name: 'Default primary action' })
    ).toHaveClass('bg-store-primary', 'h-9', 'px-4', 'text-store-primary-text');
  });

  it('renders Footer copyright and only shows local newsletter controls when enabled', () => {
    const fetchSpy = vi.spyOn(window, 'fetch');
    const { rerender } = render(
      previewInertLinkBlocks.Footer.render({
        copyrightText: '© Preview Store 2026',
        showNewsletter: true,
      })
    );

    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      '© Preview Store 2026'
    );
    expect(
      screen.getByRole('heading', { name: 'Newsletter' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Email address for newsletter' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDisabled();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();

    rerender(
      previewInertLinkBlocks.Footer.render({
        copyrightText: '© Updated preview copyright',
        showNewsletter: false,
      })
    );

    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      '© Updated preview copyright'
    );
    expect(screen.queryByRole('heading', { name: 'Newsletter' })).toBeNull();
    expect(
      screen.queryByRole('textbox', { name: 'Email address for newsletter' })
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Subscribe' })).toBeNull();
    fetchSpy.mockRestore();
  });
});
