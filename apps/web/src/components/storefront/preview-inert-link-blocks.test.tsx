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
});
