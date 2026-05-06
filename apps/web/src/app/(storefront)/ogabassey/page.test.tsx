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

  it('declares canonical, hreflang, favicon, and social image metadata for the static route', () => {
    expect(metadata.alternates).toEqual(
      expect.objectContaining({
        canonical: 'https://ogabassey.com',
        languages: {
          'en-NG': 'https://ogabassey.com',
          'x-default': 'https://ogabassey.com',
        },
      })
    );
    expect(metadata.openGraph).toEqual(
      expect.objectContaining({
        images: [
          {
            alt: 'OgaBassey storefront preview',
            height: 900,
            url: 'https://ogabassey.com/template-previews/ogabassey-v2.png',
            width: 1440,
          },
        ],
      })
    );
    expect(metadata.twitter).toEqual(
      expect.objectContaining({
        images: ['https://ogabassey.com/template-previews/ogabassey-v2.png'],
        site: '@ogabasseyy',
      })
    );
    expect(metadata.icons).toEqual({
      apple:
        'https://aivqthbxdshhltbwipbr.supabase.co/storage/v1/object/public/media/merchants/6b5cb8a4-5575-456c-b936-8cdfae30db74/favicon/apple-touch-icon.png',
      icon: 'https://aivqthbxdshhltbwipbr.supabase.co/storage/v1/object/public/media/merchants/6b5cb8a4-5575-456c-b936-8cdfae30db74/favicon/favicon-32.png',
      shortcut:
        'https://aivqthbxdshhltbwipbr.supabase.co/storage/v1/object/public/media/merchants/6b5cb8a4-5575-456c-b936-8cdfae30db74/favicon/favicon-32.png',
    });
  });
});
