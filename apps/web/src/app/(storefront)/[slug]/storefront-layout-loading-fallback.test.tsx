import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StorefrontLayoutLoadingFallback } from './storefront-layout-loading-fallback';

describe('StorefrontLayoutLoadingFallback', () => {
  it('reserves the storefront header and hero shell while layout data streams', () => {
    render(<StorefrontLayoutLoadingFallback />);

    expect(
      screen.getByRole('status', { name: /loading storefront shell/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(
      screen.getByRole('region', {
        name: /mobile hero loading placeholder/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', {
        name: /desktop hero loading placeholder/i,
      })
    ).toBeInTheDocument();
  });

  it('can render a real mobile hero image when provided', () => {
    const { container } = render(
      <StorefrontLayoutLoadingFallback
        mobileHeroImage={{
          alt: 'OgaBassey storefront hero',
          avifSrc: '/hero-mobile.avif',
          fallbackSrc: '/hero-mobile.jpg',
        }}
      />
    );

    const image = screen.getByRole('img', {
      name: /ogabassey storefront hero/i,
    });
    const sources = container.querySelectorAll('source');

    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute('media', '(max-width: 767px)');
    expect(sources[0]).toHaveAttribute('srcset', '/hero-mobile.avif');
    expect(sources[1]).toHaveAttribute('media', '(max-width: 767px)');
    expect(sources[1]).toHaveAttribute('srcset', '/hero-mobile.jpg');
    expect(image).toHaveAttribute(
      'src',
      expect.stringMatching(/^data:image\//)
    );
    expect(image).toHaveAttribute('fetchpriority', 'high');
    expect(image).toHaveAttribute('loading', 'eager');
  });
});
