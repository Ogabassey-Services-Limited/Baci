import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock(
  '@/components/storefront/ogabassey/components/ogabassey-hero-preloads',
  () => ({
    OgabasseyHeroPreloads: () => <div data-testid="hero-preloads" />,
  })
);

vi.mock('./ogabassey-home-page-content', () => ({
  OgabasseyHomePageContent: () => <main>OgaBassey storefront</main>,
}));

import OgabasseyStaticHomePage, { metadata } from './page';

describe('OgabasseyStaticHomePage', () => {
  it('renders the OgaBassey-specific home route shell', () => {
    render(<OgabasseyStaticHomePage />);

    expect(screen.getByTestId('hero-preloads')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('OgaBassey storefront');
  });

  it('declares canonical and Nigeria hreflang metadata for the static route', () => {
    expect(metadata.alternates).toEqual(
      expect.objectContaining({
        canonical: 'https://ogabassey.com',
        languages: {
          'en-NG': 'https://ogabassey.com',
          'x-default': 'https://ogabassey.com',
        },
      })
    );
  });
});
