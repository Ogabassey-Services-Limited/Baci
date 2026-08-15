import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { previewInertLinkBlocks } from './preview-inert-link-blocks';

class IntersectionObserverStub {
  disconnect() {}
  observe() {}
  unobserve() {}
}

vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);

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

  it('keeps bounded HeroCarousel slides in one production-sized viewport', () => {
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

    const carousel = screen.getByRole('region', {
      name: 'Preview hero carousel',
    });
    expect(carousel).toHaveClass('h-[85vh]', 'overflow-hidden');
    expect(carousel).toHaveAttribute('data-slide-count', '2');
    expect(carousel).toHaveAttribute('data-active-slide-index', '0');
    expect(
      screen
        .getByRole('region', { name: 'Preview hero carousel' })
        .querySelector('[data-slide-index]')
    ).toHaveClass('justify-center');
    expect(
      screen.getByRole('heading', { name: 'First slide' })
    ).toBeInTheDocument();
    expect(carousel.querySelectorAll('[data-slide-index]')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'First action' })).toBeDisabled();
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
    expect(hero.closest('section')).toHaveClass('text-right', 'py-32');
  });

  it('keeps default FAQ accordion answers collapsed', () => {
    render(
      previewInertLinkBlocks.FAQ.render({
        items: [{ answer: 'Ships in 3 days.', question: 'When does it ship?' }],
        title: 'Questions',
      })
    );

    expect(screen.getByText('When does it ship?')).toBeInTheDocument();
    expect(
      screen.getByText('When does it ship?').closest('details')
    ).not.toHaveAttribute('open');
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
      'text-store-background'
    );
    expect(
      screen.getByTestId('builder-preview-hero-overlay')
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Preview hero' })).toHaveStyle({
      backgroundImage: 'url(/hero.webp)',
    });
    expect(
      screen
        .getByRole('region', { name: 'Preview FAQ' })
        .querySelector('[data-style]')
    ).toHaveAttribute('data-style', 'grid');
  });

  it('preserves FAQ animation settings through the inert animation wrapper', () => {
    render(
      previewInertLinkBlocks.FAQ.render({
        animationDelay: 1,
        animationDuration: 'slow',
        animationTrigger: 'onload',
        animationType: 'fade-in',
        items: [{ answer: 'Answer', question: 'Question' }],
        title: 'Animated FAQ',
      })
    );

    expect(screen.getByRole('region', { name: 'Preview FAQ' })).toMatchObject({
      dataset: {
        animationDelay: '1',
        animationDuration: 'slow',
        animationTrigger: 'onload',
        animationType: 'fade-in',
      },
    });
  });

  it('does not apply a Hero overlay without a background image', () => {
    render(
      previewInertLinkBlocks.Hero.render({ overlay: true, title: 'Plain hero' })
    );

    expect(
      screen.getByRole('region', { name: 'Preview hero' })
    ).not.toHaveClass('text-store-background');
    expect(screen.queryByTestId('builder-preview-hero-overlay')).toBeNull();
  });
});
